/* BabyCalc KR 공통 스크립트 */
(function(){
  // 테마 (TomatoEggCat과 동일 키)
  try{
    var t=localStorage.getItem('tec-theme');
    if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);
  }catch(e){}
})();
/* 결과 표시 후 광고 1회 로드 (입력 화면에는 광고 없음) */
window.bcShowAd=function(){
  var w=document.getElementById('adWrap');
  if(!w||w.dataset.loaded)return;
  w.hidden=false;
  w.dataset.loaded='1';
  try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){}
};
/* 결과 영역 표시 + 광고 */
window.bcShowResult=function(id){
  var el=document.getElementById(id||'result');
  if(el){el.classList.add('show');}
  window.bcShowAd();
};
/* 텍스트 파일 다운로드 (csv/json/ics) */
window.bcDownload=function(filename,text,mime){
  var blob=new Blob([text],{type:(mime||'text/plain')+';charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},500);
};
/* localStorage JSON 헬퍼 */
window.bcStore={
  get:function(key,fallback){
    try{var v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch(e){return fallback;}
  },
  set:function(key,val){
    try{localStorage.setItem(key,JSON.stringify(val));return true;}catch(e){return false;}
  },
  del:function(key){try{localStorage.removeItem(key);}catch(e){}}
};
/* CSV 셀 이스케이프 */
window.bcCsvCell=function(v){
  v=String(v==null?'':v);
  return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
};
