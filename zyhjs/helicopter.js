const i = document.createElement("div");
fetch('/zyhhtml/helicopt.html')
  .then(response => response.text())
  .then(text => i.innerHTML = text);
document.getElementById("body-wrap").appendChild(i);