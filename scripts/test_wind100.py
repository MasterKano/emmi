import datetime as dt,io,sys,unittest
from pathlib import Path
from unittest.mock import patch
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_mtd as mtd,build_mr as mr
class Wind100(unittest.TestCase):
 def loc(self,day):
  a,b=mtd.bp._cet_bounds(day,day+dt.timedelta(days=1));times=pd.date_range(a,b,freq='h',inclusive='left')
  return {'hourly':{'time':times.strftime('%Y-%m-%dT%H:%M').tolist(),'wind_speed_100m':[8.]*len(times)}}
 def test_daily_mean_covers_dst_days(self):
  for day,n in [(dt.date(2026,3,29),23),(dt.date(2026,10,25),25),(dt.date(2026,11,1),24)]:
   loc=self.loc(day);self.assertEqual(len(loc['hourly']['time']),n)
   self.assertEqual(mtd.wind_daily_locations([loc],[day])[0]['daily']['wind_speed_100m'],[8.])
 def test_missing_forecast_history_uses_100m_era5(self):
  day=dt.date(2026,11,1);forecast=self.loc(day);forecast['hourly']['wind_speed_100m']=[None]*24
  with patch.object(mtd,'openmeteo',side_effect=[[forecast],[self.loc(day)]]) as call:
   result=mtd.fetch_weather('wind','wind_speed_100m',[(59,7)],[day],dt.date(2026,11,2),day)
  self.assertEqual(result[0]['daily']['wind_speed_100m'],[8.])
  self.assertEqual(call.call_args.kwargs['models'],'era5');self.assertEqual(call.call_args.kwargs['hourly'],'wind_speed_100m')
 def test_missing_hour_not_short_day_mean(self):
  day=dt.date(2026,11,1);loc=self.loc(day);loc['hourly']['wind_speed_100m'][0]=None
  self.assertEqual(mtd.wind_daily_locations([loc],[day])[0]['daily']['wind_speed_100m'],[None])
 def test_duplicate_hour_rejected(self):
  day=dt.date(2026,11,1);loc=self.loc(day);loc['hourly']['time'][1]=loc['hourly']['time'][0]
  with self.assertRaises(ValueError):mtd.wind_daily_locations([loc],[day])
 def test_wind100_monthly_replaces_only_wind(self):
  class Response:content=b'month,wind100,wind10_legacy\n2026-10,8.5,5.5\n'
  out={'months':['2026-10'],'temp':[5.],'rain':[2.]}
  with patch.object(mr.bp,'get',return_value=Response()):r=mr.add_wind100(out,None)
  self.assertEqual(r['wind'],[8.5]);self.assertEqual(r['wind_height_m'],100);self.assertEqual(r['temp'],[5.]);self.assertEqual(r['rain'],[2.])
 def test_no_10m_history_fallback(self):
  with patch.object(mr.bp,'get',side_effect=ValueError('offline')):
   r=mr.add_wind100({'months':['2026-10']},{'weather':{'months':['2026-10'],'wind':[5.5]}})
  self.assertEqual(r['wind'],[None]);self.assertIsNone(r['wind_height_m'])
 def test_only_verified_100m_fallback(self):
  with patch.object(mr.bp,'get',side_effect=ValueError('offline')):
   r=mr.add_wind100({'months':['2026-10']},{'weather':{'months':['2026-10'],'wind':[8.5],'wind_height_m':100}})
  self.assertEqual(r['wind'],[8.5]);self.assertEqual(r['wind_height_m'],100)
if __name__=='__main__':unittest.main()
