let express = require('express');
let router = express.Router();
let sha1 = require('sha1');
let Email_tool = require('./Email');

let Users = require('../models/Users');

let setting = {
	loginByUsername: true,
	loginByEmail: true,
	usernameMinLength: 3,
	usernameMaxLength: 16,
	passwordMinLength: 6,
	passwordMaxLength: 16,
};

/**
 * 初始化配置
 * @param obj 传入一个对象，用来加载配置
 * @returns express.Router 返回Router对象
 */
let init = function (obj) {
	let {
		loginByUsername,
		loginByEmail,
		usernameMinLength,
		usernameMaxLength,
		passwordMinLength,
		passwordMaxLength,
	} = obj;
	setting.loginByUsername = loginByUsername != null ? loginByUsername : setting.loginByUsername;
	setting.loginByEmail = loginByEmail != null ? loginByEmail : setting.loginByEmail;
	setting.usernameMinLength = usernameMinLength != null ? usernameMinLength : setting.usernameMinLength;
	setting.usernameMaxLength = usernameMaxLength != null ? usernameMaxLength : setting.usernameMaxLength;
	setting.passwordMinLength = passwordMinLength != null ? passwordMinLength : setting.passwordMinLength;
	setting.passwordMaxLength = passwordMaxLength != null ? passwordMaxLength : setting.passwordMaxLength;

	//如果不支持邮箱登陆，则必须用密码登陆
	if(!setting.loginByEmail){
		setting.loginByUsername = true;
	}
	return router;
};

/**
 * 内部调试所用方法，查看当前设置
 * @inner
 */
router.get('/', (req, res, next)=>{
	res.json(setting);
	// res.redirect(req.baseUrl+'/login');
});

/**
 * 初次使用时注册一个默认用户
 * @username killer
 * @password killer
 * @email shianqi@imudges.com
 */
router.get('/install', (req, res, next)=>{
	Users.getSize((err,data)=>{
		if(err){
			res.render('error',{'message':err});
		}else{
			if(data===0){
				new Users({
					username: 'killer',
					password: '59033478180d07080d5e4f3baa0099996c364162',
					email: 'shianqi@imudges.com',
					emailActivated: true,
				}).save();
			}
			res.redirect(req.baseUrl+'/login');
		}
	});
});

/**
 * 展示登陆界面
 */
router.get('/login', function (req, res, next) {
	res.render('login',{'message':''});
});

router.post('/login', function (req, res) {
	let _userKey = req.body.username;
	let _password = req.body.password;

	if(setting.loginByEmail&&checkEmailFormat(_userKey)){
		loginByEmail(_userKey, _password).then((data)=>{
			req.session.user = data;
			res.redirect('/');
		},()=>{
			res.render('login',{'message':'用户名或密码错误！'});
		});
	}else{
		loginByUsername(_userKey, _password).then((data)=>{
			req.session.user = data;
			res.redirect('/');
		},()=>{
			res.render('login',{'message':'用户名或密码错误！'});
		});
	}

});

/**
 * 使用密码进行登陆
 * @param username 用户名
 * @param password 密码
 * @returns {Promise}
 */
let loginByUsername = function(username, password){
	return new Promise((resolve, reject)=>{
		Users.findOne({
			username:username,
			password:sha1(password),
			emailActivated: true
		},function (err,data) {
			if(err){
				reject(err);
			}else{
				if(data==null){
					reject();
				}else {
					resolve(data);
				}
			}
		});
	});
};

/**
 * 使用邮箱进行登陆
 * @param email 邮箱
 * @param password 密码
 * @returns {Promise}
 */
let loginByEmail = function(email, password){
	return new Promise((resolve, reject)=>{
		Users.findOne({
			email:email,
			password:sha1(password),
			emailActivated: true
		},function (err,data) {
			if(err){
				reject(err);
			}else{
				if(data==null){
					reject();
				}else {
					resolve(data);
				}
			}
		});
	});
};

/**
 * 判断当前用户是否已经登陆
 * @param req 用户的 request 请求
 * @returns {boolean} 是否已经登陆，true:已经登陆，false: 还未登录
 */
let loggedIn = function (req) {
	return (typeof(req.session.user) !== "undefined");
};

/**
 * 提供注销所用方法
 */
router.get('/logout', function (req, res, next) {
	req.session.user = undefined;
	res.redirect(req.baseUrl+'/login');
});

/**
 * 展示注册界面
 */
router.get('/register', (req, res, next)=>{
	res.render('register',{message:''});
});

/**
 * 提交注册方法
 * @version 1.1
 * @method
 */
router.post('/register', (req, res, next)=>{
	let username = req.body.username;
	let password = req.body.password;
	let email = req.body.email;

	checkUsername(username).then(()=>{
		checkEmail(email).then(()=>{
			if(checkPassword(password)){
				let identifyingCode = getEmailIdentifyingCOde();
				new Users({
					username: username,
					password: sha1(password),
					email: email,
					emailActivated: false,
					identifyingCode: identifyingCode
				}).save((error)=>{
					res.redirect(req.baseUrl+'/login');
				}).then(()=>{
					sendEmailIdentifyingCode(email, identifyingCode);
				});
			}else{
				res.render('register',{message: '密码格式错误！'});
			}
		},(data)=>{
			console.log(data);
			res.render('register',{message: data.reason});
		})
	},(data)=>{
		console.log(data);
		res.render('register',{message: data.reason});
	});
});

/**
 * 显示修改密码界面
 */
router.get('/changePassword', (req, res, next)=>{
	if(loggedIn(req)){
		res.render('changePassword',{message: ''});
	}else{
		res.redirect('/users/login');
	}
});

/**
 * 提交修改密码方法
 */
router.post('/changePassword', (req, res, next)=>{
	let oldPassword = req.body.oldPassword;
	let newPassword = req.body.newPassword;
	let username = req.session.user.username;
	console.log(oldPassword,newPassword);

	if(loggedIn(req)){
		Users.findOne({username: username,password: sha1(oldPassword)}, (err, data)=>{
			if(err) console.log(err);
			if(data==null){
				res.render('changePassword',{message: '密码错误！'});
			}else{
				data.password = sha1(newPassword);
				data.save();
				res.redirect(req.baseUrl+'/login');
			}
		});
	}else{
		res.redirect('/users/login');
	}
});

/**
 * 检查邮箱格式是否合法
 * @param email
 * @returns {boolean}
 */
let checkEmailFormat = function(email){
	let reg = /^[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_.]+\.[a-zA-Z-0-9]+$/;
	return reg.test(email);
};

/**
 * 检查邮箱是否合法，首先检查格式，之后检查是否被注册
 * @version 1.0
 * @param email 用户邮箱
 * @returns {Promise}
 *  resolve: {state : true} state 状态码
 *  reject: {state: false, result: 'reason'} reason:失败原因
 */
let checkEmail = function(email){
	return new Promise((resolve, reject)=>{
		let result = {state : false};

		if(email != null){
			if(checkEmailFormat(email)){
				Users.findOne({email: email},(error, data)=>{
					if(error){
						console.log(error);
						result.reason = '服务器错误，请稍候重试';
					} else {
						if(data == null){
							result.state = true;
							resolve(result);
						}else{
							result.reason = "邮箱已被注册";
						}
					}
					reject(result);
				});
			}else{
				result.reason = '邮箱格式错误';
				reject(result);
			}
		}else{
			result.reason = '邮箱不能为空';
			reject(result);
		}
	});
};

/**
 * 发送验证邮件
 * @param email 邮箱
 * @param identifyingCode 验证码
 */
let sendEmailIdentifyingCode = function(email, identifyingCode){
	Email_tool('【FlashPass】请验证您的邮箱',
		`<h2>点击下面这个链接激活吧。</h2>
		<a href="http://localhost:3000/users/identifying?email=${email}&identifyingCode=${identifyingCode}">
		http://localhost:3000/users/identifying?email=${email}&identifyingCode=${identifyingCode}</a>`,
		email
	);
};

/**
 * 生成验证码
 * @param username 用户名
 */
let getEmailIdentifyingCOde = function(username){
	let time = new Date().valueOf();
	return sha1("killer"+time+username);
};

/**
 * 验证邮箱方法
 */
router.get('/identifying', (req, res, next)=>{
	let email = req.query.email;
	let identifyingCode = req.query.identifyingCode;
	Users.findOne({email: email,identifyingCode: identifyingCode}, (err, data)=>{
		if(err) console.log(err);
		if(data==null){
			res.render('message',{message:"验证出错。"});
		}else{
			data.emailActivated = true;
			data.save().then(()=>{
				res.render('message',{message:`验证成功。`});

			});
		}
	});
});

/**
 * 检查密码格式是否合法
 * @param password
 * @returns {boolean}
 */
let checkPassword = function(password){
	let reg = new RegExp("^[a-zA-Z-0-9_]{"+setting.passwordMinLength+","+setting.passwordMaxLength+"}$");
	return reg.test(password);
};

/**
 * 检查用户名是否合法
 * @version 1.0
 * @method
 * @param username 用户名
 * @returns {Promise}
 */
let checkUsername = function(username){
	return new Promise((resolve, reject)=>{
		let result = {state : false};
		let reg = new RegExp("^[a-zA-Z0-9_\\u4E00-\\u9FA5]{"+setting.usernameMinLength+","+setting.usernameMaxLength+"}$");
		if(!reg.test(username)){
			result.reason = "用户名格式错误";
			reject(result);
		}else{
			Users.findOne({username: username}, (error, data)=>{
				if(error){
					console.log(error);
					result.reason = '服务器错误，请稍候重试';
					reject(result);
				}else {
					if(data == null){
						result.state = true;
						resolve(result);
					}else{
						result.reason = '用户已存在';
						reject(result);
					}
				}
			});
		}
	});
};

/**
 * 供 Ajax 方法调用，检查用户名是否被注册
 */
router.post('/checkUsername', (req, res, next)=>{
	checkUsername(req.body.username).then((date)=>{
		res.json(date);
	},(data)=>{
		res.json(data);
	});
});

/**
 * 供 Ajax 方法调用，检查邮箱是否被注册
 */
router.post('/checkEmail', (req, res, next)=>{
	checkEmail(req.body.email).then((date)=>{
		res.json(date);
	},(data)=>{
		res.json(data);
	});
});

/**
 * 用户初始化FlashPass
 * @type {init}
 */
module.exports.init = init;

/**
 * 用于判断当前用户是否已经登陆
 * @type {loggedIn}
 */
module.exports.loggedIn = loggedIn;