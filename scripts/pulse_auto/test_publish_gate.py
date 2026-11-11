"""Run with the existing brief Python. No network, publication or sending."""
import datetime as dt, hashlib, importlib.util, json, tempfile, unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('pulse_publish', Path(__file__).with_name('publish.py'))
pub = importlib.util.module_from_spec(spec); spec.loader.exec_module(pub)
class Gate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.out = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)
        (self.out/'index.html').write_text('<html>checked</html>')
        (self.out/'chart.png').write_bytes(b'checked image')
        self.v = dict(status='PASS',failures=[],run_date=str(dt.datetime.now(pub.ZRH).date()),built_at=dt.datetime.now(pub.ZRH).isoformat(),images=['chart.png'],artifacts={n:hashlib.sha256((self.out/n).read_bytes()).hexdigest() for n in ['index.html','chart.png']})
        self.save()
    def save(self):
        raw=json.dumps(self.v).encode(); (self.out/'validation.json').write_bytes(raw)
        (self.out/'CHECK_PASS').write_text(hashlib.sha256(raw).hexdigest())
    def test_valid(self): self.assertEqual(pub.validate(self.out)[1], ['index.html','chart.png'])
    def test_held(self):
        self.v.update(status='HELD',failures=['stale price']);self.save()
        with self.assertRaisesRegex(ValueError,'HELD'):pub.validate(self.out)
    def test_stale_day(self):
        self.v['run_date']=str(dt.datetime.now(pub.ZRH).date()-dt.timedelta(days=1));self.save()
        with self.assertRaisesRegex(ValueError,'not today'):pub.validate(self.out)
    def test_old_build(self):
        self.v['built_at']=(dt.datetime.now(pub.ZRH)-dt.timedelta(hours=3)).isoformat();self.save()
        with self.assertRaisesRegex(ValueError,'two hours'):pub.validate(self.out)
    def test_changed_html(self):
        (self.out/'index.html').write_text('changed')
        with self.assertRaisesRegex(ValueError,'artifact changed'):pub.validate(self.out)
    def test_changed_image(self):
        (self.out/'chart.png').write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'artifact changed'):pub.validate(self.out)
    def test_changed_report(self):
        (self.out/'validation.json').write_text(json.dumps(self.v,indent=1))
        with self.assertRaisesRegex(ValueError,'marker mismatch'):pub.validate(self.out)
if __name__=='__main__':unittest.main()
