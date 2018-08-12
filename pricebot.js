require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
const request = require('request');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');


var bot = null;
var chat_id = 0;
var l_alarm = [];
var recent_ram_info = null;
var SAVE_FILE_NAME = "./alarm_list.txt";






var isNumber = (n) => {
  return !isNaN(parseFloat(n)) && isFinite(n);
}




var curFloatDigit = (f_value, i_max_float_digit) => {
	return Math.floor(f_value*Math.pow(10,i_max_float_digit))/Math.pow(10,i_max_float_digit);
}




var sendMsg = (msg) => {
	if(chat_id == 0) { console.error("The chat id is not set."); return; }
	bot.sendMessage(chat_id, msg);
}






var checkPrice = () => {

	if(recent_ram_info == null) return;

    var check_price = curFloatDigit(recent_ram_info.price, 2);
    //console.log("check_price : "+check_price);

    //check alarm prices
    for(var i=0; i<l_alarm.length; i++) {
		var o_alarm = l_alarm[i];
		
		if( (o_alarm.s_method == "buy"  && o_alarm.f_price >= check_price) ||
			(o_alarm.s_method == "sell" && o_alarm.f_price <= check_price) ) {
           	l_alarm.splice(i,1);
           	sendMsg('The price has been reached. (target price:'+o_alarm.f_price+" "+o_alarm.s_method+")");
			saveAlarmList();
			break;
        }
    }
}








var onPrice = () => {
	if(recent_ram_info == null)  {
		sendMsg("Not yet received ram price data.");
		return;
	}

	var o_dt = new Date(recent_ram_info.update_utc);
	var f_mod_price = curFloatDigit(recent_ram_info.price, 4);

	sendMsg("Current ram price is "+f_mod_price+" EOS/KB (updated on "+o_dt.getHours()+":"+o_dt.getMinutes()+")");
}



var isNotSet = (x) => {
	if(typeof x == 'undefined') return true;
	if(x == null) return true;
	
	return false;
}





var onAlaram = (token) => {

	var s_usage = "usage> alarm [price] [buy | b | sell | s]";
	var f_price = Number(token[1]);
	var s_method = token[2];	//buy, b, sell, s

	if(isNotSet(s_method) == true || (s_method != "buy" && s_method != "b" && s_method != "sell" && s_method != "s")) {
		sendMsg("Error : Invalid method value.\n"+s_usage);
		return;
	}

	if(isNumber(f_price) == false) {
		sendMsg("Error : Invalid price value.\n"+s_usage);
		return;
	}

	var o_alarm = {};
	if(s_method == "buy" || s_method == "b") o_alarm.s_method = "buy";
	else o_alarm.s_method = "sell";
	o_alarm.f_price = f_price;
	
	//duplicate price checking
	for(var i=0; i<l_alarm.length; i++) {
		var o_temp = l_alarm[i];
		if(o_temp.f_price == f_price) {
			sendMsg("Error : Already registered price.");
			return;
		}
	}

	l_alarm.push(o_alarm);
	saveAlarmList();

	sendMsg("New alarm has been added. (at "+f_price+" / count:"+l_alarm.length+")");
}







var onList = () => {
	var send_msg = "< Alarm price list >\n";

	if(l_alarm.length == 0)  {
		sendMsg("No alarms are registered.");
		return;
	}

	l_alarm.sort((l,r) => {
		return r.f_price - l.f_price;
	});

	for(var i=0; i<l_alarm.length; i++) {
		var o_alarm = l_alarm[i];
		send_msg += "["+i+"] "+o_alarm.f_price+" "+o_alarm.s_method+"\n";
	}
	
	sendMsg(send_msg);
}







var onRemove = (t_price) => {
	for(var i=0; i<l_alarm.length; i++) {
		if(l_alarm[i].f_price == t_price) {
			l_alarm.splice(i,1);
			sendMsg("The alarm has been removed. : (count:"+l_alarm.length+")");
			return;
		}
	}

	sendMsg("Error : The alarm is not exist.");
}






var onInfo = () => {
	if(recent_ram_info == null) {
		sendMsg("Recent ram info is not cached yet."); 
		return;
	}
	
	var msg = "< Recent ram info >\n[1] RAM balance :\n"+recent_ram_info.os+" KB\n"+
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
			case "alarm"  : onAlaram(token); break;
			case "ls"     :
			case "list"   : onList(); break;
			case "rm"     : 
			case "remove" : onRemove(token[1]); break;
			case "in"	  :
			case "info"	  : onInfo(); break;
        	default : sendMsg('Error : Invalid command.'); break;
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
		var data = JSON.stringify(l_alarm);

		fs.writeFile(SAVE_FILE_NAME, data, 'utf8', (err) => {
			if(err != null) { console.error(err); reject(err); return; }
			console.log("Alarm list is saved. : (count:"+l_alarm.length+")");
			resolve(null);
		});
	});
}









var loadAlarmList = () => {
	return new Promise((resolve, reject) => {
		if(fs.existsSync(SAVE_FILE_NAME) == false) { resolve(); return; }
		fs.readFile(SAVE_FILE_NAME, 'utf8', (err, data) => {
			if(err != null) { console.error(err); reject(err); return; }
			l_alarm = JSON.parse(data);	
			console.log("Alarm list is loaded. : (count:"+l_alarm.length+")");
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

	//load the price at first.
	getCurPrice();
    setInterval(()=>{
        getCurPrice();
		checkPrice();
    }, 3000);
}







main();
