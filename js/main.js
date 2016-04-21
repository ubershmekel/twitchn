$(function() {
    var defaultStreamsToShow;
    var gameToShow;
    
    var streamsContainerId = "streamsContainer";
    var streamsContainer = $('#' + streamsContainerId);
    var instructionsContainer = $('#instructionsContainer');
    var currentlyShowing = [];
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
    
    function showChannels(channels) {
        if(channels.equals(currentlyShowing)) {
            console.log("Same channels as currently showing, not updating");
            return;
        }

        for(var i = 0; i < channels.length; i++) {
            var channelName = channels[i];
            if(currentlyShowing.length > i) {
                if(currentlyShowing[i] == channelName)
                    continue;
                else {
                    streamsContainer.children()[i].remove();
                    currentlyShowing.splice(i, 1);
                }
            }
            
            console.log(channelName);
            currentlyShowing.push(channelName);
            embedTwitch(channelName);
        }
        
        currentlyShowing = channels;
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

        if(params.game) {
            instructionsContainer.remove();
            getTopStreams();
            var threeMinutesInMs = 1000 * 60 * 3;
            setInterval(getTopStreams, threeMinutesInMs);
        }
    }
    
    
    main();
});