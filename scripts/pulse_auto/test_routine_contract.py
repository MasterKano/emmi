"""No network/writes outside temporary folders. Simulate routine retries and atomic status."""
import importlib.util,json,os,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import pulse_status
spec=importlib.util.spec_from_file_location('pub',Path(__file__).with_name('publish.py'))
pub=importlib.util.module_from_spec(spec);spec.loader.exec_module(pub)
class Contract(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.addCleanup(self.tmp.cleanup)
  self.out=self.root/'current';self.out.mkdir();(self.out/'index.html').write_text('checked')
  self.v=dict(run_date='2026-11-11',last_close='2026-11-10')
 def test_atomic_fixed_status(self):
  with patch.object(pulse_status,'PATH',self.root/'latest_status.json'):
   for state,code in [('held',2),('ready',0),('published',0)]:
    pulse_status.write(state,code,['example'])
    s=json.loads(pulse_status.PATH.read_text());self.assertEqual(s['status'],state);self.assertEqual(s['exit_code'],code)
    self.assertIn('page_url',s);self.assertEqual(list(self.root.glob('.*.tmp')),[])
 def test_twice_already_published_no_git_write(self):
  with patch.object(sys,'argv',['publish.py',str(self.out)]),patch.object(pub,'validate',return_value=(self.v,['index.html'])),patch.object(pub,'existing_publication',return_value=dict(already_published=True,archive_url='https://example/')),patch.object(pub,'run') as run:
   pub.main();pub.main();run.assert_not_called()
   self.assertTrue(json.loads((self.out/'publication.json').read_text())['already_published'])
 def test_interrupted_push_resumes_same_pr(self):
  journal=self.root/'out/pulse_auto/transactions/2026-11-11.json';journal.parent.mkdir(parents=True)
  journal.write_text(json.dumps(dict(output_dir=str(self.out),head_sha='abc')))
  calls=[]
  def run(*a,**kw):
   calls.append(a)
   if a[:2]==('git','ls-remote'):return 'abc refs/heads/pulse-auto/2026-11-11'
   if a[:3]==('gh','pr','list'):return json.dumps([dict(number=123,url='https://github.com/MasterKano/emmi/pull/123')])
   if a[:3]==('gh','pr','view'):return json.dumps(dict(mergeable='MERGEABLE',headRefOid='abc',statusCheckRollup=[dict(name='build',status='COMPLETED',conclusion='SUCCESS')]))
   if a[:3]==('gh','pr','merge'):return ''
   raise AssertionError(a)
  with patch.dict(os.environ,BRIEF_ROOT=str(self.root)),patch.object(sys,'argv',['publish.py',str(self.out)]),patch.object(pub,'validate',return_value=(self.v,['index.html'])),patch.object(pub,'existing_publication',return_value=None),patch.object(pub,'run',side_effect=run),patch.object(pub,'public_ready',return_value=dict(archive_url='https://example/')):
   pub.main()
  self.assertFalse(any('push' in c or 'create' in c for c in calls))
  self.assertEqual(sum(c[:3]==('gh','pr','merge') for c in calls),1)
 def test_unknown_remote_branch_holds_without_new_pr(self):
  with patch.dict(os.environ,BRIEF_ROOT=str(self.root)),patch.object(sys,'argv',['publish.py',str(self.out)]),patch.object(pub,'validate',return_value=(self.v,['index.html'])),patch.object(pub,'existing_publication',return_value=None),patch.object(pub,'run',return_value='abc refs/heads/pulse-auto/2026-11-11') as run:
   with self.assertRaisesRegex(RuntimeError,'no local validation journal'):pub.main()
   self.assertEqual(run.call_count,1)
if __name__=='__main__':unittest.main()
