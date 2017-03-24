let express = require('express');
let router = express.Router();
let sha1 = require('sha1');

let Users = require('../models/Users');

let setting = {
	loginByUsername: true,
	loginByEmail: true,
	usernameMinLength: 3,
	usernameMaxLength: 16,
	passwordMinLength: 6,
	passwordMaxLength: 16,
};

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

router.get('/login', function (req, res, next) {
	res.render('login',{'message':''});
});

router.post('/login', function (req, res) {
	Users.findOne({username:req.body.username,password:sha1(req.body.password)},function (err,data) {
		if(err){
			res.render('error',{'message':err});
		}else{
			if(data==null){
				res.render('login',{'message':'用户名或密码错误！'});
			}else {
				req.session.user = data;
				res.redirect('/');
			}
		}
	});
});

let loggedIn = function (req) {
	return (typeof(req.session.user) !== "undefined");
};

router.get('/logout', function (req, res, next) {
	req.session.user = undefined;
	res.redirect('/login');
});

router.get('/register', (req, res, next)=>{
	res.render('register',{message:''});
});

router.post('/register', (req, res, next)=>{
	checkUsername(req.body.username).then(()=>{
		checkEmail(req.body.email).then(()=>{
			if(checkPassword(req.body.password)){
				new Users({
					username: req.body.username,
					password: sha1(req.body.username),
					email: req.body.email,
					emailActivated: true,
				}).save((error)=>{
					res.redirect(req.baseUrl+'/login');
				});
			}else{
				res.render('register',{message: '密码格式错误！'});
			}
		},(data)=>{
			console.log(1);
			res.render('register',{message: data.reason});
		})
	},(data)=>{
		console.log(2);
		console.log(data);
		res.render('register',{message: data.reason});
	});
});


/**
 * 检查邮箱是否合法，首先检查格式，之后检查是否被注册
 * @param email
 * @returns {Promise}
 */
let checkEmail = function(email){
	return new Promise((resolve, reject)=>{
		let result = {state : false};
		let reg = /^[a-zA-Z0_\-.]+@[a-zA-Z0-9_.]+\.[a-zA-Z-0-9]+$/;

		if(email != null){
			if(reg.test(email)){
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
 * 检查密码格式是否合法
 * @param password
 * @returns {boolean}
 */
let checkPassword = function(password){
	let reg = new RegExp("^[a-zA-Z-0-9_]{"+setting.usernameMinLength+","+setting.usernameMaxLength+"}$");
	return reg.test(password);
};

/**
 * 检查用户名是否合法
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