var mydebug = {};

$(function() {
    var defaultStreamsToShowCount;
    var gameToShow;
    
    var streamsContainerId = "streamsContainer";
    var streamsContainer = $('#' + streamsContainerId);
    var instructionsContainer = $('#instructionsContainer');
    var previouslyShowingChannels = [];
    var isAjaxing = false;

    function indexToPositionInTable(index, amountOfSlots) {
        var oneDimCount = Math.ceil(Math.sqrt(amountOfSlots));
        return {
            x: index % oneDimCount,
            y: Math.floor(index / oneDimCount)
        };
    }
    
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
        
    function embedTwitch(channelName, widthAndHeight) {
        // Using this embed mechanism
        
        var options = {
            width: widthAndHeight,
            height: widthAndHeight,
            channel: channelName
        };
        var player = new Twitch.Player(streamsContainerId, options);
        player.setVolume(0); // 1.0 = max
        
        // "offline": Emitted when loaded channel goes offline.
        player.addEventListener("offline", streamWentOffline);
    }
    
    function roundDecimal(num, precision) {
        // Simplification of https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/round
        // Time 10 to the power of precision and round
        var bigger = Math.round(num + 'e' + precision);
        // `e-` shrinks the number back down
        // `+` converts to number
        return +(bigger + 'e-' + precision);
    }
    
    function showChannels(newChannels) {
        // Mark previous streams for deletion. This step isn't necessary
        // but it's more explicit and provides protection against jQuery having
        // a surprising change in its API.
        var previousElements = streamsContainer.children();
        for(var i = 0; i < previousElements.length; i++) {
            previousElements[i].keepAlive = false;
        }
        
        // Reposition and embed channels
        var oneDimCount = Math.ceil(Math.sqrt(defaultStreamsToShowCount));
        // E.g. "50%" for 4 windows, "33.33%" for 9.
        // This page says that "33.33%" is accurate enough for all screens.
        // http://stackoverflow.com/questions/5158735/best-way-to-represent-1-3rd-of-100-in-css
        var percentOfWindow = roundDecimal(100.0 / oneDimCount, 2);
        
        for(var i = 0; i < newChannels.length; i++) {
            var channelName = newChannels[i];
            var previouslyShowingChannelsIndex = previouslyShowingChannels.indexOf(channelName);
            var el;
            if(previouslyShowingChannelsIndex > -1) {
                // Found loaded channel - just reposition it
                el = previousElements[previouslyShowingChannelsIndex];
                // Don't delete it
                el.keepAlive = true;
            } else {
                // New stream, create it
                console.log("Embedding new: " + channelName);
                var widthAndHeight = percentOfWindow + "%";
                embedTwitch(channelName, widthAndHeight);
                el = streamsContainer.children().last()[0];
            }

            var pos = indexToPositionInTable(i, defaultStreamsToShowCount);
            var percentX = (percentOfWindow * pos.x) + "%";
            var percentY = (percentOfWindow * pos.y) + "%";
            el.style.left = percentX;
            el.style.top = percentY;
        }
        
        // Remove excess channels
        for(var i = 0; i < previousElements.length; i++) {
            if(previousElements[i].keepAlive)
                continue;
            previousElements[i].remove();
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
        
        var streamsToShow = defaultStreamsToShowCount;
        if (defaultStreamsToShowCount > streams.length)
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
        defaultStreamsToShowCount = params.panels || 4;
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
