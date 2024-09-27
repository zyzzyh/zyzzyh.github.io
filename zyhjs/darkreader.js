// window.addEventListener("change", (event) => {
// 	var pppppp=getComputedStyle(document.documentElement).getPropertyValue('data-darkreader-scheme');
// 	if(pppppp=="dark")console.log("darkkkkkkkkk");
// 	else console.log(pppppp);});

window.addEventListener("load", (event) => {
  var pppppp=getComputedStyle(document.documentElement).getPropertyValue('data-theme');
	if(pppppp=='dark')console.log("darkkkkkkkkk");
	else console.log(pppppp);
});
// onchange = (event) => 
// {
// 	var pppppp=getComputedStyle(document.documentElement).getPropertyValue('data-darkreader-scheme');
// 	if(pppppp=="dark")console.log("darkkkkkkkkk");
// 	else console.log(pppppp)
// };
