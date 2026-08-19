/* 흔한 비밀번호·약한 단어 목록 — 강도 감점용 (자체 정리)
 * 유출 목록 전체가 아니라, 실제로 가장 자주 쓰이는 패턴의 대표 항목만 담았다.
 * 부분 문자열로 검사하므로 password1! 같은 변형도 걸린다. */
window.GENLAB_WEAKPW = [
  'password','passwd','pass','pwd','qwerty','qwertz','asdf','zxcv','1234','12345',
  'abcd','abc123','letmein','welcome','admin','administrator','root','user','guest','test',
  'login','master','secret','iloveyou','princess','sunshine','dragon','monkey','football','baseball',
  'shadow','superman','batman','trustno1','starwars','whatever','freedom','computer','internet','samsung',
  'hello','hellow','default','changeme','newpass','temppass','qazwsx','1q2w3e','1qaz2wsx','zaq12wsx',
  'korea','seoul','hangul','sarang','saranghae','bogoshipda','anjfma','dkssud','dlfjs','wkdrl',
  'birthday','myname','oneone','ilove','loveyou','forever','angel','happy','lucky','money'
];
