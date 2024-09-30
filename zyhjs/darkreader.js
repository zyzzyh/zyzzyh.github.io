var url = window.location.pathname;
if(document.getElementsByTagName('html')[0].getAttribute('data-darkreader-scheme') == 'dark')
{
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