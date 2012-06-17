/*
* asyc-document.write.
* Author: Florentin Zorca
*/
(function(){
	var calls = 0, implants = 0, queue = [], originalWrite = document.write, lastImplant;

	var log = function (text) {
        console.log('Calls:' + calls + ', Queue:' + queue.length + ', ' + text);
    };
	var next = function(todo, timeout){
		//todo();
		setTimeout(function () {todo();}, timeout?timeout:100);
	};
	var addHook = function (parent, id) {
        var el = document.createElement('span');
        el.id = id;
        parent.appendChild(el);
        return el;
    };
	var enqueue = function(implant){
		queue.push(implant);
		lastImplant = implant;
	};
	var getLastHook = function(){
		if(lastImplant) return lastImplant.scriptNode? lastImplant.scriptNode: lastImplant.hookNode;
		else return null;
	};
	var appendToLastImplant = function(text){
		if(lastImplant){
			lastImplant.content += text;
			log(' <- Appended to queue for ' + lastImplant.hookNode.id + ': ' + text);
		}
	};
	var enqueueHtmlImplant = function(scriptNode, text){
		var id = 'hook-' + implants++, el;
		el = addHook(scriptNode.parentNode, id);
		enqueue({hookNode: el, scriptNode: scriptNode, contentType: 'html', content: text});
		log(' <- Queued write to ' + id + ': ' + text);
	};
	var replaceScriptNodeWithHook = function(scriptNode){
		var parentNode = scriptNode.parentNode, hook;
		hook = document.createElement('span');
        hook.id = 'hook-' + implants++;
		
		if(!parentNode.replaceChild(hook, scriptNode)){
			parentNode.removeChild(scriptNode);
			parentNode.appendChild(hook);
		}
		
		return hook;
	};
	var enqueueScriptImplant = function(hookNode, scriptNode){
		
		if(scriptNode.src){
			enqueue({hookNode: hookNode, contentType: 'script-extern', content: scriptNode.src});
			log(' <- Queued external script to ' + hookNode.id + ': ' + scriptNode.src);
		}else{
			enqueue({hookNode: hookNode, contentType: 'script-inline', content: scriptNode.text});
			log(' <- Queued inline script to ' + hookNode.id + ': ' + scriptNode.text);
		}
	};
	var enqueueOrAppend = function(lastScript, text){
		var lastHook = getLastHook();
		if (!lastScript || (lastHook === lastScript)) {
			appendToLastImplant(text); // append to the last one for those concatenating string by repeatedly calling document.write
		}
		else {
			enqueueHtmlImplant(lastScript, text);
		}
	};
	var write = function () {
        var al = arguments.length, scripts, lastScript, source;
        if (al) {
            calls++;
			source = Array.prototype.slice.call(arguments).join('');

			scripts = document.getElementsByTagName('script');
			if (scripts.length > 0) lastScript = scripts[scripts.length - 1];

			enqueueOrAppend(lastScript, source);
		}
    };
	var inject = function (implant, callback) {
        var async = false, stillToDo = 0;
		var makeScript = function(parentNode, text){
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.text = text;
			parentNode.appendChild(script);
			return script;
		};
		var getScript = function(parentNode, url){
			async = true;
            stillToDo++;
			log(stillToDo + '. Asynch script: ' + url);
			$.ajax({
				url: url,
				dataType: 'script',
				async:true,
				timeout:2000,
				complete: function(jqXHR, textStatus){
                    stillToDo--;
                    log(textStatus + ': loaded ' + url + ', still to load: ' + stillToDo);

                    if (0 === stillToDo) {
						console.log('Finished joining asynchronous script loading, now calling back.');
                        if (callback) callback();
                    }
				}
			});
		};
		var injectHtml = function(parentNode, text){
            var el = document.createElement('span'), balast = "&nbsp;", hookNode, scriptList, script;
            el.innerHTML = balast + text; // weird workaround for IE! innerHTML with only script is ignored!
			el.id = parentNode.id + '-inj';

            scriptList = el.getElementsByTagName('script');
            while (scriptList.length > 0) {
				script = scriptList[0]; // by replacing the node, the list is automatically updated by DOM
				hookNode = replaceScriptNodeWithHook(script); 
                enqueueScriptImplant(hookNode, script);
            }
			
			if(el.innerHTML){
				// REMARK: the DOM would be cleaner when replacing the hook with the content node: parentNode.parentNode.replaceChild(parentNode, el);
				el.removeChild(el.childNodes[0]); // remove the balast
				parentNode.appendChild(el); // with the script tags stripped away
				log(' -> Injected static html to ' + parentNode.id + ': id = ' + el.id + ', content = ' + el.innerHTML);
			}
		};
		
		if(implant){
			if (implant.hookNode && implant.content) {
			
				// replace document.write here
				document.write = function () {
					var al = arguments.length, i, source;
					if(al){
						calls++;
						source = Array.prototype.slice.call(arguments).join('');
						enqueueOrAppend(implant.hookNode, source);
						log(' <- Appended to context implant ' + implant.hookNode.id + ': ' + source);
					}
				};
			
				switch(implant.contentType){ // REMARK: should these methods return a promise?
					case 'script-inline':
						makeScript(implant.hookNode, implant.content);
						break;
					case 'script-extern':
						getScript(implant.hookNode, implant.content);
						break;
					case 'html':
						injectHtml(implant.hookNode, implant.content);
						break;
				}
			}else{
				log('Could not find hook node ' + (implant.hookNode)?implant.hookNode.id:'NULL');
			}
		}else{
			log('No implant?');
		}
		
        console.log('Asynch scripts spawned ' + stillToDo);
        if (!async && callback){
			console.log('Calling back after pure inline content.');
			callback();
		}
    };
	
	var dequeue = function (){
		var implant, id;
		if (queue.length > 0){
			log('Dequeuing');
			implant = queue.shift();
			inject(implant, function(){
				if(implant && implant.hookNode) id = implant.hookNode.id;
				else id = '';
					
				if (queue.length > 0) {
					log(implant.hookNode.id + ' done. Dequeue next one.');
					next(dequeue);
				}
				else {
					log(implant.hookNode.id + ' done. It was the last queue item.');
					lastImplant = null;
				}
			});
		}
		else{
			log('Dequeue from empty queue.');
		}
	};
	
	var asyncWrite = {
		write: write,
		applyWrite: function(timeoutInMs){
			next(dequeue);
		}
	};

	// replace browser's blocking document.write
	document.write = asyncWrite.write;
	// add the method to apply the captured document.write calls
	document.applyWrite = asyncWrite.applyWrite;
	
	// AMD define happens at the end for compatibility with AMD loaders
    // that don't enforce next-turn semantics on modules.
	if (typeof define === 'function' && define.amd) {
		define('asyncWrite', function() {
			return asyncWrite;
		});
	}
	
	return asyncWrite;
})(window);