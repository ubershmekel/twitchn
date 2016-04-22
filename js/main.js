var mydebug = {};

$(function() {
    var defaultStreamsToShow;
    var gameToShow;
    
    var streamsContainerId = "streamsContainer";
    var streamsContainer = $('#' + streamsContainerId);
    var instructionsContainer = $('#instructionsContainer');
    var previouslyShowingChannels = [];
    var isAjaxing = false;

    function urlGetParams() {
        try {
            var search = location.search.substring(1); // `1` skips question mark
            var jsonStr = '{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}';
            return JSON.parse(jsonStr);
        } catch (e) {
            return {};
        }
    }

    function streamWentOffline(e) {
        console.log("Stream went offline: ", e);
        getTopStreams();
    }
    
    function embedTwitch3(channelName) {
        // prevents the 10 js errors, but shows the old flash UI and seems to be a bit slower.
        var percent = '"50%"'
        var e = $('<object type="application/x-shockwave-flash"' +
            ' height=' + percent +
            ' width=' + percent +
            ' id="embed_' + channelName +
            '" class="stream" data="http://www.twitch.tv/widgets/live_embed_player.swf?channel="' + channelName +
            '"><param name="allowFullScreen" value="true" /><param name="allowScriptAccess" value="always" /><param name="allowNetworking" value="all" />' + 
            '<param name="movie" value="http://www.twitch.tv/widgets/live_embed_player.swf" /><param name="flashvars" value="hostname=www.twitch.tv&channel=' +
            channelName + '&auto_play=true&start_volume=0" /></object>');
        streamsContainer.append(e);
    }
    
    function embedTwitch2(channelName) {
        // This does not require the twitch js file
        // but has no "offline" event.
        var percent = '"50%"'
        var elementStr = '<iframe' +
            ' src="http://player.twitch.tv/?channel=' + channelName + '"' +
            ' height=' + percent +
            ' width=' + percent +
            ' frameborder="0"' +
            ' scrolling="no"'+
            ' allowfullscreen="true">' +
            ' </iframe>';
        
        streamsContainer.append($(elementStr));
    }
        
    function embedTwitch(channelName) {
        // Using this embed mechanism
        //var percent = "50%";
        var oneDimCount = Math.ceil(Math.sqrt(defaultStreamsToShow));
        var percent = Math.floor(100.0 / oneDimCount) + "%";
        
        var options = {
            width: percent,
            height: percent,
            channel: channelName
        };
        var player = new Twitch.Player(streamsContainerId, options);
        player.setVolume(0); // 1.0 = max
        
        // "offline": Emitted when loaded channel goes offline.
        player.addEventListener("offline", streamWentOffline);
    }
    
    function moveIndexToIndex(jq, indexSrc, indexDst) {
        var src = jq.children()[indexSrc];
        var dst = jq.children()[indexDst];
        jq[0].insertBefore(src, dst);
    }
    
    //streamsContainer[0].insertBefore(src, dst);function moveElement(container, be)
    
    function showChannels(newChannels) {
        //if(channels.equals(previouslyShowing)) {
        //    console.log("Same channels as currently showing, not updating");
        //    return;
        //}
        var previousElements = streamsContainer.children();
        for(var i = 0; i < newChannels.length; i++) {
            var channelName = newChannels[i];
            var previouslyShowingChannelsIndex = previouslyShowingChannels.indexOf(channelName);
            if(previouslyShowingChannelsIndex > -1) {
                //if(currentlyShowingIndex == i) {
                //    // stay where you are
                //    console.log("Correctly placed");
                //    continue;
                //}
                console.log("repositioning " + previouslyShowingChannelsIndex + " to " + i);
                streamsContainer[0].appendChild(previousElements[previouslyShowingChannelsIndex]);
                
                // just move the stram to position
                //moveIndexToIndex(streamsContainer, currentlyShowingIndex, i);
                //var previousEl = previousElements[previouslyShowingChannelsIndex];
                //streamsContainer[0].insertBefore(src, dst);
                //currentlyShowing.splice(currentlyShowingIndex, 1);
                //currentlyShowing.splice(currentlyShowingIndex, 0, channelName);
                continue;
            }
            /*
                if(currentlyShowing[i] == channelName)
                    continue;
                else {
                    streamsContainer.children()[i].remove();
                    currentlyShowing.splice(i, 1);
                }
            }*/
            
            // New stream, create it, put it at the end
            console.log("Embedding new: " + channelName);
            embedTwitch(channelName);
            /*
            if(i < currentlyShowing.length) {
                // not the last stream
                // based on assumption that twitch embed is the last element in the streams container
                // we move that element to the correct index.
                var el = streamsContainer.children().last();
                var beforeThisEl = streamsContainer.children()[i];
                streamsContainer[0].insertBefore(el, beforeThisEl);
                currentlyShowing.splice(i, 0, channelName);
            } else {
                currentlyShowing.push(channelName);
            }*/
        }
        
        // Remove excess that was not appended to end. These elements are at the start.
        var totalChildren = streamsContainer.children().length;
        for(var j = newChannels.length; j < totalChildren; j++) {
            streamsContainer.children()[0].remove();
        }
        
        // Document new state
        previouslyShowingChannels = newChannels;
    }

    function handleData(data) {
        console.log(data);
        var streams = data.streams;
        streams.sort(function(a, b) {
            // most popular first
            return b.viewers - a.viewers;
        });
        
        var streamsToShow = defaultStreamsToShow;
        if (defaultStreamsToShow > streams.length)
            streamsToShow = streams.length;
        
        var newChannels = [];
        for(var i = 0; i < streamsToShow; i++) {
            var channelName = streams[i].channel.name;
            newChannels.push(channelName)
        }
        
        showChannels(newChannels);
        isAjaxing = false;
    };
    
    function failedAjax(err) {
        console.warn('Failed ajax:', err);
        humane.error("An error fetching streams: " + err);
        isAjaxing = false;
    }
    
    function getTopStreams() {
        if(isAjaxing)
            return;

        isAjaxing = true;
        var jsonUrl = "https://api.twitch.tv/kraken/streams?game=" + gameToShow;
        $.ajax({
            url: jsonUrl,
            dataType: 'jsonp',
            success: handleData,
            error: failedAjax,
            timeout: 5000
        });
    }
    
    function main() {
        params = urlGetParams();
        defaultStreamsToShow = params.panels || 4;
        gameToShow = params.game;

        if(gameToShow) {
            document.title = "Twitchn - " + gameToShow;
            instructionsContainer.remove();
            getTopStreams();
            var threeMinutesInMs = 1000 * 60 * 3;
            setInterval(getTopStreams, threeMinutesInMs);
        }

        mydebug.previouslyShowingChannels = function() { return previouslyShowingChannels;};
        mydebug.showChannels = showChannels;
    }
    
    
    main();
});
