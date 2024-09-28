(function(window, document) {
	let $$this,
	  defaults = {
	  	deg1: 2,
	  	len1: 7,
		showTime: 20, //绘制的线条显示的时间 drawType为1时生效
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
						deg-=0.27431;
						if(deg<3.1415926)deg+=6.2831852;
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
						body[0].x = mouse_pos_x+len*Math.sin(deg);
						body[0].y = mouse_pos_y+len*Math.cos(deg);
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
