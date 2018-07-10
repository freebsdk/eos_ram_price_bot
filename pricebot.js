const console_stamp = require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
const request = require('request');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');


var bot = null;
var cur_ram_price = 0.0;
var last_update_utc = 0;
var chat_id = 0;
var alarm_list = [];
var SAVE_FILE_NAME = "./alarm_list.txt";






var isNumber = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
}








var sendMsg = (msg) => {
	if(chat_id == 0) { console.error("The chat id is not set."); return; }
	bot.sendMessage(chat_id, msg);
}






var checkPrice = () => {

	if(cur_ram_price == 0.0) return;

    var check_price = (Math.floor(cur_ram_price * 10))/10;
    //console.log("check_price : "+check_price);

    //check alarm prices
    for(var i=0; i<alarm_list.length; i++) {
        var a_price = alarm_list[i];
        if(a_price == check_price) {
            alarm_list.splice(i,1);
            sendMsg('The price has been reached. (target price:'+a_price+")");
			saveAlarmList();
			break;
        }
    }
}








var onPrice = () => {
	var cur_utc = new Date().getTime();

	if(cur_ram_price == 0)  {
		sendMsg("Not yet received ram price data.");
	}
	else {
		sendMsg("Current ram price is "+cur_ram_price+" ("+(cur_utc-last_update_utc)+" sec before)");
	}
}







var onAlaram = (price) => {

	if(isNumber(price) == false) {
		sendMsg("Invalid price value.");
		return;
	}

	alarm_list.push(Number(price));
	saveAlarmList();

	sendMsg("New alarm has been added. (at "+price+" / count:"+alarm_list.length+")");
}







var onList = () => {

	var send_msg = "< Alarmed price List >\n";

	if(alarm_list.length == 0)  {
		send_msg += "No alarms are registered.";
	}
	else {
		alarm_list.sort();
		for(var i=0; i<alarm_list.length; i++) {
			send_msg += "["+i+"] "+alarm_list[i]+"\n";
		}	
	}

	sendMsg(send_msg);
}







var onRemove = (t_price) => {
	for(var i=0; i<alarm_list.length; i++) {
		if(alarm_list[i] == t_price) {
			alarm_list.splice(i,1);
			sendMsg("The alarm has been removed. : (count:"+alarm_list.length+")");
			return;
		}
	}

	sendMsg("The alarm is not exist.");
}







var initTelegram = (telegram_token) => {
	bot = new TelegramBot(telegram_token, {polling: true});	

	bot.on('message', msg => {
    	chat_id = msg.chat.id;
		token = msg.text.split(' ');
		console.log(token[0]);

    	switch(token[0]) {
			case "pr": 
        	case "price"  : onPrice(); break;
			case "al"     : 
			case "alarm"  : onAlaram(token[1]); break;
			case "ls"     :
			case "list"   : onList(); break;
			case "rm"     : 
			case "remove" : onRemove(token[1]); break;
        	default : sendMsg('Invalid command.'); break;
    	}
	});
}








var getCurPrice = () => {

    var c_ut = new Date().getTime();
    var s_ut = c_ut - (5*60 * 1000);
    var e_ut = c_ut;

    var requestOption = {
        method: 'GET',
        timeout: 60 * 1000,
        url: 'https://eos.feexplorer.io/json/EOSramPrice2.php',
        qs: {
            start: s_ut,
            end: e_ut,
            callback: ""
		},
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
			'Referer': 'https://eos.feexplorer.io/',
			'Host' : 'eos.feexplorer.io',
			'Cookie' : '__cfduid=dbe353522565b8757353ad64d7ce5e4c01530546695; _ga=GA1.2.1335495326.1530546702; PHPSESSID=hn09a69v4hbkkdds3pmsqvdioa; _gid=GA1.2.1718015334.1531203633; _pk_ses.3.3979=*; _pk_id.3.3979=13a21d7980e4de71.1530546703.6.1531233419.1531231274.'	
		},
        forever: true,
        agent: false
    };

    request.get(requestOption, (err, res, body) => {
        if (err != null) { console.error(err); return; }

        try {
            var last_price_list = JSON.parse(body.substring(1, body.length-1));
        }
        catch(ex) {
			console.log("error : "+ex.message+":"+body);
            return;
        }

		cur_ram_price = Number(last_price_list[last_price_list.length-1][1]);
		last_update_utc = new Date().getTime();
		console.log(cur_ram_price);
    });
}







var saveAlarmList = () => {
	return new Promise((resolve, reject) => {
		var data = JSON.stringify(alarm_list);

		fs.writeFile(SAVE_FILE_NAME, data, 'utf8', (err) => {
			if(err != null) { console.error(err); reject(err); return; }
			console.log("alarm list file saved. : (count:"+alarm_list.length+")");
			resolve(null);
		});
	});
}









var loadAlarmList = () => {
	return new Promise((resolve, reject) => {
		if(fs.existsSync(SAVE_FILE_NAME) == false) { resolve(); return; }
		fs.readFile(SAVE_FILE_NAME, 'utf8', (err, data) => {
			if(err != null) { console.error(err); reject(err); return; }
			alarm_list = JSON.parse(data);	
			console.log("alarm list file loaded. : (count:"+alarm_list.length+")");
			resolve();
		});
	});
}








var main = async() => { 

	var args = process.argv.slice(2);
	if(args.length < 1) { 
		console.error("[!] Please specify command line arguments.");
		console.error("$process [telegram token]");
		return;
	}

	await loadAlarmList();	
	initTelegram(args[0]);

    setInterval(()=>{
        getCurPrice();
		checkPrice();
    }, 5000);
}







main();
