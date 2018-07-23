const console_stamp = require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
const request = require('request');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');


var bot = null;
var chat_id = 0;
var alarm_list = [];
var recent_ram_info = null;
var SAVE_FILE_NAME = "./alarm_list.txt";






var isNumber = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
}








var sendMsg = (msg) => {
	if(chat_id == 0) { console.error("The chat id is not set."); return; }
	bot.sendMessage(chat_id, msg);
}






var checkPrice = () => {

	if(recent_ram_info == null) return;

    var check_price = (Math.floor(recent_ram_info.price * 100))/100;
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

	if(recent_ram_info == null)  {
		sendMsg("Not yet received ram price data.");
		return;
	}

	var dt = new Date(recent_ram_info.update_utc);
	sendMsg("Current ram price is "+recent_ram_info.price+" EOS/KB (updated on "+dt.getMinutes()+"m:"+dt.getSeconds()+"s)");
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
	var send_msg = "< Alarmed price list >\n";

	if(alarm_list.length == 0)  {
		sendMsg("No alarms are registered.");
		return;
	}

	alarm_list.sort();
	for(var i=0; i<alarm_list.length; i++) {
		send_msg += "["+i+"] "+alarm_list[i]+"\n";
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






var onInfo = () => {
	if(recent_ram_info == null) {
		sendMsg("[!] Recent ram info is not cached yet."); 
		return;
	}
	
	var ratio = recent_ram_info.os / (64*1024*1024);
	ratio = 100 - (Math.floor(ratio * 100 * 100) / 100);

	var msg = "< Recent ram info >\n[1] RAM balance :\n"+recent_ram_info.os+" KB (occupied "+ratio+"%)\n"+
		"[2] Outstanding balance :\n"+recent_ram_info.cb+" EOS";
	sendMsg(msg);
}







var initTelegram = (telegram_token) => {
	bot = new TelegramBot(telegram_token, {polling: true});	

	bot.on('message', msg => {
    	chat_id = msg.chat.id;
		token = msg.text.split(' ');

    	switch(token[0]) {
			case "pr": 
        	case "price"  : onPrice(); break;
			case "al"     : 
			case "alarm"  : onAlaram(token[1]); break;
			case "ls"     :
			case "list"   : onList(); break;
			case "rm"     : 
			case "remove" : onRemove(token[1]); break;
			case "in"	  :
			case "info"	  : onInfo(); break;
        	default : sendMsg('Invalid command.'); break;
    	}
	});
}







var getCurPrice = () => {

    var c_ut = Math.floor(new Date().getTime()/1000);

    var requestOption = {
        method: 'POST',
        timeout: 60 * 1000,
       	url: 'https://api.eosnewyork.io/v1/chain/get_table_rows',
		headers: {
			'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36',
			'Referer': 'https://eos.feexplorer.io/',
			'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
		},
		body : '{"json":"true", "code":"eosio", "scope":"eosio", "table":"rammarket", "limit":"10"}',
        forever: true,
        agent: false
    };

    request.post(requestOption, (err, res, body) => {
        if (err != null) { console.error(err); return; }

        try {
			//console.log(body);
            var res_obj = JSON.parse(body).rows[0];
        }
        catch(ex) {
			console.error("error : "+ex.message+":"+body);
			recent_ram_info = null;
            return;
        }

		recent_ram_info = {};

        const CW = 1;
		recent_ram_info.cb = Number(res_obj.quote.balance.split(" ")[0]); //connector balance
		recent_ram_info.os = Math.floor(Number(res_obj.base.balance.split(" ")[0])/1024); //byte to kbyte
		recent_ram_info.price = recent_ram_info.cb / (recent_ram_info.os * CW);
		recent_ram_info.update_utc = new Date().getTime();

		//console.log(recent_ram_info.price);
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
