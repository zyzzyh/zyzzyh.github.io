var url = window.location.pathname;
if(url=="/")
{
	Snackbar.show({pos: 'top-center',text: '此网站提供深色模式，可将页面向下滑动后，在右下角设置按钮处打开。', actionTextColor: '#ffff00',onActionClick: function(){	Snackbar.show({pos: 'top-center',text: '如果你在使用 darkreader 请关闭', actionTextColor: '#ffff00' });
} });
}