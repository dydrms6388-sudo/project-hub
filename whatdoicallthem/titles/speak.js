/* shared pronunciation helper for the Korean title reference pages */
(function(){
  "use strict";
  function toast(msg){
    var t=document.getElementById("toast");
    if(!t)return;
    t.textContent=msg;t.classList.add("show");
    clearTimeout(t._tm);t._tm=setTimeout(function(){t.classList.remove("show");},1800);
  }
  function speak(text){
    if(!("speechSynthesis" in window)){toast("Your browser can't read this aloud");return;}
    try{
      var u=new SpeechSynthesisUtterance(text);
      u.lang="ko-KR";u.rate=.9;
      speechSynthesis.cancel();speechSynthesis.speak(u);
    }catch(e){toast("Your browser can't read this aloud");}
  }
  Array.prototype.forEach.call(document.querySelectorAll("button.say"),function(b){
    b.addEventListener("click",function(){speak(b.getAttribute("data-ko"));});
  });
})();
