"""Weekday lag rule: Jerry approved 11 Nov 2026 07:20 Zurich, answered card t1089s3453."""
import datetime as dt,time
from lib import daily_rules
LAG_BOARD={'hsi','nky','csi','csi300','asx','iron','sofr','us2','us10','us30','de2','de10','gb10','ch10','jp10','2s10s','hy','euhy'}
def prior_business_day(required):
    # Same weekday/holiday calendar the weekday Pulse uses to identify its required close.
    return daily_rules.last_session(dt.date.fromisoformat(str(required)[:10])).isoformat()
def permitted(label, required, board_key=None, board=None):
    lag = label.startswith(('risk ', 'Gas storage ')) or label=='TTF curve' or board_key in LAG_BOARD or (board or {}).get('group')=='Rates (%)'
    return prior_business_day(required) if lag else str(required)[:10]
def date_label(date):return 'as of '+dt.date.fromisoformat(str(date)[:10]).strftime('%-d %b')
class FredRetry:
    """One fresh successful fetch per series per command; up to three attempts, 1s/2s backoff."""
    def __init__(self,fetch,log,sleeper=time.sleep):self.fetch=fetch;self.log=log;self.sleep=sleeper;self.cache={};self.attempts={}
    def __call__(self,sid):
        if sid in self.cache:return self.cache[sid].copy()
        for n in range(1,4):
            self.attempts[sid]=n
            try:
                result=self.fetch(sid)
                if result is None or result.dropna().empty:raise ValueError('empty FRED series')
                self.cache[sid]=result.copy();return result
            except Exception:
                self.log.warning('FRED %s attempt %d/3 failed',sid,n)
                if n==3:raise
                self.sleep(2**(n-1))
