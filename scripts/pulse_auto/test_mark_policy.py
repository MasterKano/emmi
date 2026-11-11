"""Approved policy tests: no network or publication."""
import sys, unittest
from pathlib import Path
sys.path.insert(0,'/workspace/brief')
sys.path.insert(0,str(Path(__file__).parent))
import pandas as pd
from mark_policy import permitted,FredRetry
class Log:
 def warning(self,*a):pass
class Policy(unittest.TestCase):
 def test_strict_core_prices(self):
  for k in ('brent','wti','ttf','spx','sxxp','dax','eurusd','gold','silver','copper'):
   self.assertEqual(permitted(k,'2026-11-10',k,{}),'2026-11-10')
 def test_one_business_day(self):
  for k in ('hsi','nky','csi300','iron','sofr','us2','us10','jp10'):
   self.assertEqual(permitted(k,'2026-11-10',k,{}),'2026-11-09')
  for lab in ('risk hy','risk curve','Gas storage EU','Gas storage DE','TTF curve'):
   self.assertEqual(permitted(lab,'2026-11-10'),'2026-11-09')
 def test_weekend_boundary(self):self.assertEqual(permitted('risk hy','2026-11-09'),'2026-11-06')
 def test_power_strict(self):
  self.assertEqual(permitted('Nord Pool delivery 2026-11-11','2026-11-11'),'2026-11-11')
 def test_retries_then_same_run_reuse(self):
  calls=[];wait=[]
  def fetch(sid):
   calls.append(sid)
   if len(calls)<3:raise TimeoutError()
   return pd.Series([3.],index=pd.to_datetime(['2026-11-09']))
  retry=FredRetry(fetch,Log(),wait.append)
  self.assertEqual(float(retry('SID').iloc[0]),3.)
  self.assertEqual(float(retry('SID').iloc[0]),3.)
  self.assertEqual(len(calls),3);self.assertEqual(wait,[1,2])
 def test_missing_after_three_attempts(self):
  calls=[];wait=[]
  def fetch(sid):calls.append(sid);raise TimeoutError()
  retry=FredRetry(fetch,Log(),wait.append)
  with self.assertRaises(TimeoutError):retry('SID')
  self.assertEqual(len(calls),3);self.assertEqual(wait,[1,2])
if __name__=='__main__':unittest.main()
