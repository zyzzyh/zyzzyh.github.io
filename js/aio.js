(function(window, document) {
	let $$this,
	  defaults = {
	  	deg1: 2,
	  	len1: 7,
		showTime: 12, //绘制的线条显示的时间 drawType为1时生效
		multi: 1.5,//放大倍率
		multiDom: null,//需要放大的dom节点对象
		border: null
	  };
	let width = window.innerWidth,
		height = window.innerHeight;
	let mouser = function(options) {
		$$this = this;
		$$this.options = Object.assign(defaults, options);
		$$this.init();
	};
	mouser.prototype = {
		changeModel: function(option) {
			$$this.options = Object.assign($$this.options, option);
			document.getElementById("mouser-style").remove();
			document.getElementById("mouser").remove();
			$$this.init();
		},
		hexToRgb: function(hex) {
			return 'rgb(' + parseInt('0x' + hex.slice(1, 3)) + ',' + parseInt('0x' + hex.slice(3, 5)) + ',' + parseInt('0x' + hex.slice(5, 7)) + ')';
		},
		hexToRgba: function(hex,opacity) {
			return 'rgba(' + parseInt('0x' + hex.slice(1, 3)) + ',' + parseInt('0x' + hex.slice(3, 5)) + ',' + parseInt('0x' + hex.slice(5, 7)) + ',' + opacity + ')';
		},
		//验证画布是否为空
		isCanvasBlank: function(canvas) {
			var blank = document.createElement('canvas');//系统获取一个空canvas对象
			blank.width = canvas.width;
			blank.height = canvas.height;
			return canvas.toDataURL() == blank.toDataURL();//比较值相等则为空
		},
		//判断dom中是否包含某个子节点或者标签
		isInDom: function (node, father = document.body, isNode = true) {
			if (isNode) return (node === father) ? false : father.contains(node);
			else father.getElementsByTagName(node).length ? true : false;
		},
		init: function() {
			//设置样式
			const cssStr = `body{width:100vw;min-height:100vh;padding:0;margin:0;z-index:2002;}`;
			let style = document.createElement("style");
			style.type = "text/css";
			style.id = "mouser-style";
			style.innerHTML = cssStr;
			document.getElementsByTagName("head").item(0).appendChild(style);
			//创建画布
			{
				let domCanvas = document.createElement("canvas");
				domCanvas.id = "mouser";
				domCanvas.style =
					"position: fixed;top: 0;left: 0;width: 100%;height: 100%;z-index: 999;pointer-events: none;";
				document.body.appendChild(domCanvas);
				var canvas = document.getElementById("mouser")
				var ctx = canvas.getContext("2d");
				canvas.width = width;
				canvas.height = height;
				canvas.clipContent = false; //当子项目的边界超出此容器时，显示子项目在此容器中。
				function resize() {
					width = window.innerWidth;
					height = window.innerHeight;
					canvas.width = width;
					canvas.height = height;
				}
				window.addEventListener('resize', resize);
			}
			{
					let body = [];
					let mouse_pos_x = canvas.width / 2;
					let mouse_pos_y = canvas.height / 2;
					let delta = 1;
					let step = 0;
					let loop = 0;
					let line = 7;
					let TWO_PI = 2 * Math.PI;
					let t = 0;
					let op = 1;
					let bodyLength = $$this.options.showTime;
					let deg = $$this.options.deg1;
					let len = $$this.options.len1;
					let lstx=mouse_pos_x;
					let lsty=mouse_pos_y;
					let tmp=1;
					document.body.addEventListener('mousemove', mouse_track);

					function mouse_track(event) {
						if ((Math.abs(mouse_pos_x - event.clientX) > delta) || (Math.abs(mouse_pos_y - event
								.clientY) > delta)) {
							mouse_pos_x = event.clientX;
							mouse_pos_y = event.clientY;
						}
					}
					let red = [];
					let grn = [];
					let blu = [];
					let center = 128;
					let width = 127;
					let frequency1 = 0.3;
					let frequency2 = 0.3;
					let frequency3 = 0.3;
					let phase1 = 0;
					let phase2 = 2;
					let phase3 = 4;
					for (let s = 0; s < bodyLength; s++) {
						red[s] = Math.round(Math.sin(frequency1 * s + phase1) * width + center);
						grn[s] = Math.round(Math.sin(frequency2 * s + phase2) * width + center);
						blu[s] = Math.round(Math.sin(frequency3 * s + phase3) * width + center);
					}
					let size = Math.min(canvas.width, canvas.height) / 50;
					//见下文
					let startX = canvas.width / 2 + size * (16 * Math.sin(0) * Math.sin(0) * Math.sin(0));
					let startY = canvas.height - (canvas.height / 2 + (size * (13 * Math.cos(0) - 5 * Math
						.cos(0) - 2 * Math.cos(0) - Math.cos(0))));
					for (let i = 0; i < bodyLength; i++) {
						let b = {
							x: startX,
							y: startY
						};
						body.push(b);
					}
					// 绘制
					function draw() {
						loop++;
						if (loop == 5) {
							step++;
							step = step % bodyLength;
							loop = 0;
						}
						canvas.width = window.innerWidth;
						canvas.height = window.innerHeight;
						for (let i = (body.length - 1); i > 0; i--) {
							body[i].x = body[i - 1].x;
							body[i].y = body[i - 1].y;
						}
						if(Math.abs(mouse_pos_x-lstx)>=delta||Math.abs(mouse_pos_y-lsty)>=delta)tmp=6;
						else 
						{
							
							if(tmp>0)tmp--;
							if(tmp==0)
							{
								deg-=0.37431;
								if(deg<3.1415926)deg+=6.2831852;
							}
						}
						lstx=mouse_pos_x;
						lsty=mouse_pos_y;
						body[0].x = mouse_pos_x;
						body[0].y = mouse_pos_y;
						if(tmp==0)
						{
							body[0].x+=len*Math.sin(deg);
							body[0].y+=len*Math.cos(deg);
						}
						ctx.lineWidth = line;
						ctx.strokeStyle = "rgb(" + red[step] + "," + grn[step] + "," + blu[step] + ")";
						ctx.fillStyle = "rgb(" + red[step] + "," + grn[step] + "," + blu[step] + ")";
						//绘制前导圆
						ctx.beginPath();
						ctx.arc((body[0].x), (body[0].y), line / 2, 0, TWO_PI);
						ctx.fill();
						//绘制线
						ctx.beginPath();
						ctx.moveTo(body[0].x, body[0].y);
						for (let s = 0; s < body.length - 2; s++) {
							//贝塞尔曲线:
							var xc = (body[s].x + body[s + 1].x) / 2;
							var yc = (body[s].y + body[s + 1].y) / 2;
							ctx.quadraticCurveTo(body[s].x, body[s].y, xc, yc);
						}
						ctx.stroke();
						//绘制尾随圆
						ctx.beginPath();
						ctx.arc(xc, yc, line / 2, 0, TWO_PI);
						ctx.fill();
						window.requestAnimationFrame(draw);
					}
					window.requestAnimationFrame(draw);
			}
		}
	};
	window.Mouser = mouser;
})(window, document);
let mouser = new Mouser();



var url = window.location.pathname;
if(document.getElementsByTagName('html')[0].getAttribute('data-darkreader-scheme') == 'dark')
{
	var script = document.createElement('script');
	script.src = '/pluginsSrc/node-snackbar/dist/snackbar.min.js?v=0.1.16';
	document.body.appendChild(script);
	// let tt=0;
	Snackbar.show({pos: 'top-center',text: '此网站提供深色模式，可将页面向下滑动后，在右下角设置按钮处打开。\n 如果你在使用 darkreader 请关闭', actionTextColor: '#ffff00',onActionClick: function(){	
			if(document.getElementsByTagName('html')[0].getAttribute('data-darkreader-scheme') != 'dark')Snackbar.show({pos: 'top-center',text: 'hello', actionTextColor: '#ffff00' });
			else Snackbar.show({pos: 'top-center',text: '呜呜呜，快关了 darkreader 。', actionTextColor: '#ffff00' });
			// tt=1;
	} });
	// if(tt==0)
	// {
	// 	Snackbar.show({pos: 'top-center',text: '如果你在使用 darkreader 请关闭', actionTextColor: '#ffff00' });
	// }
}
document.write(" <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" \/>");
document.write("");
document.write("    <style>");
document.write("      * {");
document.write("        box-sizing: border-box;");
document.write("      }");
document.write("");
document.write("      html,");
document.write("      body {");
document.write("        height: 100%;");
document.write("      }");
document.write("");
document.write("      body {");
document.write("        overflow: hidden;");
document.write("        display: grid;");
document.write("        color: white;");
document.write("        background: black;");
document.write("      }");
document.write("    <\/style>");
document.write("  <\/head>");
document.write("  <body>");
document.write("    <pointer-particles><\/pointer-particles>");
document.write("");
document.write("    <script>");
document.write("      class PointerParticle {");
document.write("        constructor(spread, speed, component) {");
document.write("          const { ctx, pointer, hue } = component;");
document.write("");
document.write("          this.ctx = ctx;");
document.write("          this.x = pointer.x;");
document.write("          this.y = pointer.y;");
document.write("          this.mx = pointer.mx * 0.1;");
document.write("          this.my = pointer.my * 0.1;");
document.write("          this.size = Math.random() + 1;");
document.write("          this.decay = 0.01;");
document.write("          this.speed = speed * 0.08;");
document.write("          this.spread = spread * this.speed;");
document.write("          this.spreadX = (Math.random() - 0.5) * this.spread - this.mx;");
document.write("          this.spreadY = (Math.random() - 0.5) * this.spread - this.my;");
document.write("          this.color = `hsl(${hue}deg 90% 60%)`;");
document.write("        }");
document.write("");
document.write("        draw() {");
document.write("          this.ctx.fillStyle = this.color;");
document.write("          this.ctx.beginPath();");
document.write("          this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);");
document.write("          this.ctx.fill();");
document.write("        }");
document.write("");
document.write("        collapse() {");
document.write("          this.size -= this.decay;");
document.write("        }");
document.write("");
document.write("        trail() {");
document.write("          this.x += this.spreadX * this.size;");
document.write("          this.y += this.spreadY * this.size;");
document.write("        }");
document.write("");
document.write("        update() {");
document.write("          this.draw();");
document.write("          this.trail();");
document.write("          this.collapse();");
document.write("        }");
document.write("      }");
document.write("");
document.write("      class PointerParticles extends HTMLElement {");
document.write("        static register(tag = 'pointer-particles') {");
document.write("          if ('customElements' in window) {");
document.write("            customElements.define(tag, this);");
document.write("          }");
document.write("        }");
document.write("");
document.write("        static css = `");
document.write("    :host {");
document.write("      display: grid;");
document.write("      width: 100%;");
document.write("      height: 100%;");
document.write("      pointer-events: none;");
document.write("    }");
document.write("  `;");
document.write("");
document.write("        constructor() {");
document.write("          super();");
document.write("");
document.write("          this.canvas;");
document.write("          this.ctx;");
document.write("          this.fps = 60;");
document.write("          this.msPerFrame = 1000 \/ this.fps;");
document.write("          this.timePrevious;");
document.write("          this.particles = [];");
document.write("          this.pointer = {");
document.write("            x: 0,");
document.write("            y: 0,");
document.write("            mx: 0,");
document.write("            my: 0,");
document.write("          };");
document.write("          this.hue = 0;");
document.write("        }");
document.write("");
document.write("        connectedCallback() {");
document.write("          const canvas = document.createElement('canvas');");
document.write("          const sheet = new CSSStyleSheet();");
document.write("");
document.write("          this.shadowroot = this.attachShadow({ mode: 'open' });");
document.write("");
document.write("          sheet.replaceSync(PointerParticles.css);");
document.write("          this.shadowroot.adoptedStyleSheets = [sheet];");
document.write("");
document.write("          this.shadowroot.append(canvas);");
document.write("");
document.write("          this.canvas = this.shadowroot.querySelector('canvas');");
document.write("          this.ctx = this.canvas.getContext('2d');");
document.write("          this.setCanvasDimensions();");
document.write("          this.setupEvents();");
document.write("          this.timePrevious = performance.now();");
document.write("          this.animateParticles();");
document.write("        }");
document.write("");
document.write("        createParticles(event, { count, speed, spread }) {");
document.write("          this.setPointerValues(event);");
document.write("");
document.write("          for (let i = 0; i < count; i++) {");
document.write("            this.particles.push(new PointerParticle(spread, speed, this));");
document.write("          }");
document.write("        }");
document.write("");
document.write("        setPointerValues(event) {");
document.write("          this.pointer.x = event.x - this.offsetLeft;");
document.write("          this.pointer.y = event.y - this.offsetTop;");
document.write("          this.pointer.mx = event.movementX;");
document.write("          this.pointer.my = event.movementY;");
document.write("        }");
document.write("");
document.write("        setupEvents() {");
document.write("          const parent = this.parentNode;");
document.write("");
document.write("          parent.addEventListener('click', (event) => {");
document.write("            this.createParticles(event, {");
document.write("              count: 300,");
document.write("              speed: Math.random() + 1,");
document.write("              spread: Math.random() + 50,");
document.write("            });");
document.write("          });");
document.write("");
document.write("          parent.addEventListener('pointermove', (event) => {");
document.write("            this.createParticles(event, {");
document.write("              count: 20,");
document.write("              speed: this.getPointerVelocity(event),");
document.write("              spread: 1,");
document.write("            });");
document.write("          });");
document.write("");
document.write("          window.addEventListener('resize', () => this.setCanvasDimensions());");
document.write("        }");
document.write("");
document.write("        getPointerVelocity(event) {");
document.write("          const a = event.movementX;");
document.write("          const b = event.movementY;");
document.write("          const c = Math.floor(Math.sqrt(a * a + b * b));");
document.write("");
document.write("          return c;");
document.write("        }");
document.write("");
document.write("        handleParticles() {");
document.write("          for (let i = 0; i < this.particles.length; i++) {");
document.write("            this.particles[i].update();");
document.write("");
document.write("            if (this.particles[i].size <= 0.1) {");
document.write("              this.particles.splice(i, 1);");
document.write("              i--;");
document.write("            }");
document.write("          }");
document.write("        }");
document.write("");
document.write("        setCanvasDimensions() {");
document.write("          const rect = this.parentNode.getBoundingClientRect();");
document.write("");
document.write("          this.canvas.width = rect.width;");
document.write("          this.canvas.height = rect.height;");
document.write("        }");
document.write("");
document.write("        animateParticles() {");
document.write("          requestAnimationFrame(() => this.animateParticles());");
document.write("");
document.write("          const timeNow = performance.now();");
document.write("          const timePassed = timeNow - this.timePrevious;");
document.write("");
document.write("          if (timePassed < this.msPerFrame) return;");
document.write("");
document.write("          const excessTime = timePassed % this.msPerFrame;");
document.write("");
document.write("          this.timePrevious = timeNow - excessTime;");
document.write("");
document.write("          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);");
document.write("          this.hue = this.hue > 360 ? 0 : (this.hue += 3);");
document.write("");
document.write("          this.handleParticles();");
document.write("        }");
document.write("      }");
document.write("");
document.write("      PointerParticles.register();");
document.write("    <\/script>");
document.write("  <\/body>");
document.write("<html>");

function getbbdata(){
  var bbsurl = bbShortApiUrl
  
  var httpRequest = new XMLHttpRequest();//第一步：建立所需的对象
  httpRequest.open('GET', bbsurl, true);//第二步：打开连接  将请求参数写在url中  ps:"./Ptest.php?name=test&nameone=testone"
  httpRequest.send();//第三步：发送请求  将请求参数写在URL中
  /**
   * 获取数据后的处理程序
   */
  httpRequest.onreadystatechange = function () {
  if (httpRequest.readyState == 4 && httpRequest.status == 200) {
      var json = httpRequest.responseText;//获取到json字符串，还需解析
      var obj = eval('(' + json + ')');
      // console.log(obj.data)
      const bbArray = obj.data.map(e => {
      return {
          'date': e.date,
          'content': e.content,
          'from': e.from
      }
      })
      // console.log(fundsArray)
      saveToLocal.set('zhheo-bb', JSON.stringify(bbArray), 5 / (60 * 24))
      const data = saveToLocal.get('zhheo-bb');
      generateBBHtml(JSON.parse(data))
  }
  };
}


var generateBBHtml = array => {
    var $dom = document.querySelector('#bber-talk');
    var result = ''

    if (array.length) {
      for (let i = 0; i < array.length; i++) {
        var itemcontent = array[i].content
        var newitemcontent = itemcontent.replace(/(https?:[^:<>"]*\/)([^:<>"]*)(\.((png!thumbnail)|(png)|(jpg)|(webp)|(jpeg)|(gif)))/g,' [图片] ')
        result += `<div class='li-style swiper-slide'>${newitemcontent}</div>`;
      }
    } else {
      result += '!{_p("aside.card_funds.zero")}';
    }
    
    var $dom = document.querySelector('#bber-talk');
    $dom.innerHTML = result;
    window.lazyLoadInstance && window.lazyLoadInstance.update();
    window.pjax && window.pjax.refresh($dom);
    var swiper = new Swiper('.swiper-container', {
      direction: 'vertical', // 垂直切换选项
      loop: true,
      autoplay: {
        delay: 3000,
        disableOnInteraction: true,
        pauseOnMouseEnter: true,
      },
  });
  }
var bbInit = () => {
// console.log('运行')
if (document.querySelector('#bber-talk')) {
    const data = saveToLocal.get('zhheo-bb');
    if (data) {
    generateBBHtml(JSON.parse(data))
    } else {
    getbbdata()
    };
}
}

bbInit();
document.addEventListener('pjax:complete', bbInit);
// RightMenu 鼠标右键菜单



let rmf = {};

// 显示右键菜单
rmf.showRightMenu = function(isTrue, x, y){
    let $rightMenu = $('#rightMenu');

    $rightMenu.hide();

    $rightMenu.css('top',x+'px').css('left',y+'px');

    if(isTrue){
        $rightMenu.show();
    }else{
        $rightMenu.hide();
    }
}

// 昼夜切换
rmf.switchDarkMode = function(){
    const nowMode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    if (nowMode === 'light') {
        activateDarkMode()
        saveToLocal.set('theme', 'dark', 2)
        GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.day_to_night)
    } else {
        activateLightMode()
        saveToLocal.set('theme', 'light', 2)
        GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.night_to_day)
    }
    // handle some cases
    typeof utterancesTheme === 'function' && utterancesTheme()
    typeof FB === 'object' && window.loadFBComment()
    window.DISQUS && document.getElementById('disqus_thread').children.length && setTimeout(() => window.disqusReset(), 200)
};

// 阅读模式
rmf.switchReadMode = function(){
    const $body = document.body
    $body.classList.add('read-mode')
    const newEle = document.createElement('button')
    newEle.type = 'button'
    newEle.className = 'fas fa-sign-out-alt exit-readmode'
    $body.appendChild(newEle)

    function clickFn () {
        $body.classList.remove('read-mode')
        newEle.remove()
        newEle.removeEventListener('click', clickFn)
    }

    newEle.addEventListener('click', clickFn)
}

//复制选中文字
rmf.copySelect = function(){
    document.execCommand('Copy',false,null);
    //这里可以写点东西提示一下 已复制
}

//回到顶部
rmf.scrollToTop = function(){
    btf.scrollToDest(0, 500);
}
let pageX;
let pageY;
// 右键菜单事件
if(! (navigator.userAgent.match(/(phone|pad|pod|iPhone|iPod|ios|iPad|Android|Mobile|BlackBerry|IEMobile|MQQBrowser|JUC|Fennec|wOSBrowser|BrowserNG|WebOS|Symbian|Windows Phone)/i))){
    window.oncontextmenu = function(event){
        $('.rightMenu-group.hide').hide();
        //如果有文字选中，则显示 文字选中相关的菜单项
        if(document.getSelection().toString()){
            $('#menu-text').show();
        }

        // console.log(event.target);
        pageX = event.clientX + 10;
        pageY = event.clientY;
        let rmWidth = $('#rightMenu').width();
        let rmHeight = $('#rightMenu').height();
        if(pageX + rmWidth > window.innerWidth){
            pageX -= rmWidth+10;
        }
        if(pageY + rmHeight > window.innerHeight){
            pageY -= pageY + rmHeight - window.innerHeight;
        }



        rmf.showRightMenu(true, pageY, pageX);
        return false;
    };

    window.addEventListener('click',function(){rmf.showRightMenu(false,pageX,pageY);});
    // window.addEventListener('load',function(){rmf.switchTheme(true);});
}
var nnnnew=document.createElement("div");
nnnnew.setAttribute('id', 'rightMenu');
nnnnew.setAttribute('style', 'display: none');
nnnnew.innerHTML=
"<div class=\"rightMenu-group rightMenu-small\"><a class=\"rightMenu-item\" href=\"javascript:window.history.back();\" data-pjax-state=\"\"><i class=\"fa-solid fa-arrow-left\"></i> </a><a class=\"rightMenu-item\" href=\"javascript:window.location.reload();\" data-pjax-state=\"\"><i class=\"fa-solid fa-arrow-rotate-right\"></i> </a><a class=\"rightMenu-item\" href=\"javascript:window.history.forward();\" data-pjax-state=\"\"><i class=\"fa-solid fa-arrow-right\"></i> </a><a class=\"rightMenu-item\" id=\"menu-radompage\" href=\"javascript:window.location.href = window.location.origin;\" data-pjax-state=\"\"><i class=\"fa-solid fa-house\"></i></a></div><div class=\"rightMenu-group rightMenu-line hide\" id=\"menu-text\" style=\"display:none\"><a class=\"rightMenu-item\" href=\"javascript:rmf.copySelect();\" data-pjax-state=\"\"><i class=\"fa-solid fa-copy\"></i> <span>复制</span></a></div><div class=\"rightMenu-group rightMenu-line\"><a class=\"rightMenu-item\" href=\"javascript:rmf.switchDarkMode();\" data-pjax-state=\"\"><i class=\"fa-solid fa-circle-half-stroke\"></i> <span>昼夜模式</span></a></div><div class=\"rightMenu-group rightMenu-line\"><a class=\"rightMenu-item\" href=\"javascript:window.location.href = window.location.origin + '/categories/';\" data-pjax-state=\"\"><i class=\"fa-solid fa-book\"></i> <span>博客分类</span> </a><a class=\"rightMenu-item\" href=\"javascript:window.location.href = window.location.origin + '/tags/';\" data-pjax-state=\"\"><i class=\"fa-solid fa-tags\"></i> <span>博客标签</span></a></div><div class=\"rightMenu-group rightMenu-line\"><a class=\"rightMenu-item\" href=\"javascript:window.location.href = window.location.origin + '/about-website/';\" data-pjax-state=\"\"><i class=\"fa-solid fa-envelope-open-text\"></i> <span>网站声明</span></a></div><div class=\"rightMenu-group rightMenu-line\"><a class=\"rightMenu-item\" href=\"javascript:window.location.reload(true);\" data-pjax-state=\"\"><i class=\"fa-solid fa-arrow-rotate-right\"></i> <span>ctrl + F5</span></a></div>"
;
document.body.appendChild(nnnnew);
function dark() {
    window.requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
    var n, e, i, h, t = .05,
        s = document.getElementById("universe"),
        o = !0,
        a = "180,184,240",
        r = "226,225,142",
        d = "226,225,224",
        c = [];

    function f() {
        n = window.innerWidth, e = window.innerHeight, i = .216 * n, s.setAttribute("width", n), s.setAttribute("height", e)
    }

    function u() {
        h.clearRect(0, 0, n, e);
        for (var t = c.length, i = 0; i < t; i++) {
            var s = c[i];
            s.move(), s.fadeIn(), s.fadeOut(), s.draw()
        }
    }

    function y() {
        this.reset = function () {
            this.giant = m(3), this.comet = !this.giant && !o && m(10), this.x = l(0, n - 10), this.y = l(0, e), this.r = l(1.1, 2.6), this.dx = l(t, 6 * t) + (this.comet + 1 - 1) * t * l(50, 120) + 2 * t, this.dy = -l(t, 6 * t) - (this.comet + 1 - 1) * t * l(50, 120), this.fadingOut = null, this.fadingIn = !0, this.opacity = 0, this.opacityTresh = l(.2, 1 - .4 * (this.comet + 1 - 1)), this.do = l(5e-4, .002) + .001 * (this.comet + 1 - 1)
        }, this.fadeIn = function () {
            this.fadingIn && (this.fadingIn = !(this.opacity > this.opacityTresh), this.opacity += this.do)
        }, this.fadeOut = function () {
            this.fadingOut && (this.fadingOut = !(this.opacity < 0), this.opacity -= this.do / 2, (this.x > n || this.y < 0) && (this.fadingOut = !1, this.reset()))
        }, this.draw = function () {
            if (h.beginPath(), this.giant) h.fillStyle = "rgba(" + a + "," + this.opacity + ")", h.arc(this.x, this.y, 2, 0, 2 * Math.PI, !1);
            else if (this.comet) {
                h.fillStyle = "rgba(" + d + "," + this.opacity + ")", h.arc(this.x, this.y, 1.5, 0, 2 * Math.PI, !1);
                for (var t = 0; t < 30; t++) h.fillStyle = "rgba(" + d + "," + (this.opacity - this.opacity / 20 * t) + ")", h.rect(this.x - this.dx / 4 * t, this.y - this.dy / 4 * t - 2, 2, 2), h.fill()
            } else h.fillStyle = "rgba(" + r + "," + this.opacity + ")", h.rect(this.x, this.y, this.r, this.r);
            h.closePath(), h.fill()
        }, this.move = function () {
            this.x += this.dx, this.y += this.dy, !1 === this.fadingOut && this.reset(), (this.x > n - n / 4 || this.y < 0) && (this.fadingOut = !0)
        }, setTimeout(function () {
            o = !1
        }, 50)
    }

    function m(t) {
        return Math.floor(1e3 * Math.random()) + 1 < 10 * t
    }

    function l(t, i) {
        return Math.random() * (i - t) + t
    }
    f(), window.addEventListener("resize", f, !1),
        function () {
            h = s.getContext("2d");
            for (var t = 0; t < i; t++) c[t] = new y, c[t].reset();
            u()
        }(),
        function t() {
            document.getElementsByTagName('html')[0].getAttribute('data-theme') == 'dark' && u(), window.requestAnimationFrame(t)
        }()
};
dark()