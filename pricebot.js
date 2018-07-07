import { listenerCount } from 'cluster';

const request = require('request');
const TelegramBot = require('node-telegram-bot-api');


var bot = null;
var cur_ram_price = 0.0;
var timer = null;
var chat_id = 0;

var alarm_list = [];




var sendMsg = (msg) => {
	bot.sendMessage(chat_id, msg);
}






var onStart = () => {

	//Avoid duplicate starts
	if(timer != null) return;

	sendMsg("Price monitoring has began.");

	timer = setInterval(() => {
		//sendMsg('price:'+cur_ram_price);
		
		var check_price = (Math.floor(cur_ram_price * 100))/100;
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

	}, 3000);
}







var onEnd = () => {
		
	sendMsg("Price monitoring has stopped.");
	if(timer != null) { clearInterval(timer); timer = null; }
}







var onPrice = () => {
	sendMsg("Current ram price is "+cur_ram_price);
}





var onAlaram = (price) => {
	alarm_list.push(Number(price));
	sendMsg("New alarm has been added. (at "+price+" / count:"+alarm_list.length+")");
}





var onList = () => {

	var send_msg = "< Alarm price List >\n";

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
        	case "price": onPrice(); break;
			case "start": onStart(); break;
			case "alarm": onAlaram(token[1]); break;
			case "ls" : onList(); break;
			case "rm" : onRemove(token[1]); break;
			case "end":
        	case "stop": onEnd(); break;
        	default : sendMsg('Invalid command.'); break;
    	}
	});
}








var getCurPrice = () => {

    var c_ut = new Date().getTime();
    var s_ut = c_ut - (30 * 1000);
    var e_ut = c_ut;

    var requestOption = {
        method: 'GET',
        timeout: 60 * 1000,
        url: 'https://eos.feexplorer.io/json/EOSramPrice.php',
        qs: {
            start: s_ut,
            end: e_ut,
            callback: ""
        },
        forever: true,
        agent: false
    };

    request.get(requestOption, function (err, res, body) {
        if (err != null) { console.error(err); return; }

        try {
            var last_price_list = JSON.parse(body.substring(1, body.length-1));
        }
        catch(ex) {
            return;
        }

		cur_ram_price = Number(last_price_list[last_price_list.length-1][1]);
		//console.log(cur_ram_price);
    });
}








var main = () => { 

	var args = process.argv.slice(2);
	if(args.length < 1) { 
		console.error("[!] Please specify command line arguments.");
		console.error("$process [telegram token]");
		return;
	}

	initTelegram(args[0]);

    setInterval(()=>{
        getCurPrice();
    }, 3000);
}




main();
