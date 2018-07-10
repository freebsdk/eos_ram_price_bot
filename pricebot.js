const request = require('request');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');


var bot = null;
var cur_ram_price = 0.0;
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
    console.log("check_price : "+check_price);

    //check alarm prices
    for(var i=0; i<alarm_list.length; i++) {
        var a_price = alarm_list[i];
        if(a_price == check_price) {
            alarm_list.splice(i,1);
            sendMsg('The price has been reached. (target price:'+a_price+")");
            break;
        }
    }
}








var onPrice = () => {
	sendMsg("Current ram price is "+cur_ram_price);
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
    var s_ut = c_ut - (60 * 1000);
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
        forever: true,
        agent: false
    };

    request.get(requestOption, (err, res, body) => {
		console.log("err:"+err+" | body:"+body);
        if (err != null) { console.error(err); return; }

        try {
            var last_price_list = JSON.parse(body.substring(1, body.length-1));
        }
        catch(ex) {
			console.log("error : "+ex.message+":"+body);
            return;
        }

		cur_ram_price = Number(last_price_list[last_price_list.length-1][1]);
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
    }, 3000);
}







main();
