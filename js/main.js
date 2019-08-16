/*global Twitch $ error humane Mustache */

var mydebug = {};

$(function() {
    var defaultStreamsToShowCount;
    var gameToShow;
    
    var streamsContainerId = "streamsContainer";
    var channelKey = 'channel';
    var streamsContainer = $('#' + streamsContainerId);
    var instructionsContainer = $('#instructionsContainer');
    var previouslyShowingChannels = [];
    var isAjaxing = false;
    var recentlyOffline = {};
    var players = [];
    mydebug.players = players;
    var defaultHeaders = {
        "Client-ID": "ms529ptsbx3rk8sf3mk7m50othshk1i",
        "Accept": "application/vnd.twitchtv.v5+json",
    }

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
            var jsonStr = '{"' + decodeURIComponent(search.replace(/\+/g, '%20')).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"')  + '"}';
            return JSON.parse(jsonStr);
        } catch (e) {
            return {};
        }
    }

    function createPlayer() {
        var instance = {};

        instance.streamWentOfflineEvent = function() {
            var channelName = instance.channelName;
            console.log("Stream went offline: ", new Date(), channelName);
            recentlyOffline[channelName] = new Date();
            // Giving the API a moment to catch up with the stream going offline
            setTimeout(getTopStreams, 1000);
        };

        instance.init = function(channelName, widthAndHeight) {
            // Only call this once please or you might leak handlers.
            instance.channelName = channelName;
            var options = {
                width: widthAndHeight,
                height: widthAndHeight,
                channel: channelName
            };
            instance._player = new Twitch.Player(streamsContainerId, options);
            instance._player.setVolume(0); // 1.0 = max
            
            // Twitch.Player.OFFLINE: Emitted when loaded channel goes offline.
            instance._player.addEventListener(Twitch.Player.OFFLINE, instance.streamWentOfflineEvent);
            // Twitch.Player.ENDED : Emitted when video or stream ends.
            instance._player.addEventListener(Twitch.Player.ENDED, instance.streamWentOfflineEvent);

            instance.element = streamsContainer.children().last()[0];
            // document this element's channel name
            $(instance.element).data(channelKey, channelName);
            
        };

        instance.setChannel = function(channelName) {
            instance.channelName = channelName;
            instance._player.setChannel(channelName);
            instance._player.play();
        };

        instance.isOnline = function() {
            return !instance._player.getEnded();
        }

        return instance;
    }

    function embedTwitch(channelName, widthAndHeight) {
        var newPlayer = createPlayer();
        newPlayer.init(channelName, widthAndHeight);
        players.push(newPlayer);
        return newPlayer;
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
        
        // Logging to catch issues with a streamer being offline and not removed
        console.log('newChannels:', new Date(), newChannels);
        
        // Mark previous streams for deletion.
        previouslyShowingChannels = [];
        var reusePlayers = [];
        for(var i = 0; i < players.length; i++) {
            // Reusing existing players that fell out of favor or went offline
            // to avoid memory leaks
            // https://discuss.dev.twitch.tv/t/gigabytes-of-memory-leaks-when-removing-twitch-embeds/9836
            var existingChannel = players[i].channelName;
            previouslyShowingChannels.push(existingChannel);
            if (newChannels.indexOf(existingChannel) == -1 || !players[i].isOnline()) {
                reusePlayers.push(players[i]);
            }
        }
        
        // Reposition and embed channels
        var oneDimCount = Math.ceil(Math.sqrt(defaultStreamsToShowCount));
        // E.g. "50%" for 4 windows, "33.33%" for 9.
        // This page says that "33.33%" is accurate enough for all screens.
        // http://stackoverflow.com/questions/5158735/best-way-to-represent-1-3rd-of-100-in-css
        var percentOfWindow = roundDecimal(100.0 / oneDimCount, 2);
        
        for(var j = 0; j < newChannels.length; j++) {
            var channelName = newChannels[j];
            var previouslyShowingChannelsIndex = previouslyShowingChannels.indexOf(channelName);
            var el;
            if(previouslyShowingChannelsIndex > -1) {
                // Found loaded channel - just reposition it
                el = players[previouslyShowingChannelsIndex].element;
            } else {
                // New stream, create it or repurpose an existing player
                console.log("Embedding new: " + channelName);
                var widthAndHeight = percentOfWindow + "%";
                if (reusePlayers.length > 0) {
                    // replace a player that has fallen off the top n
                    var playerToReplace = reusePlayers.shift();
                    playerToReplace.setChannel(channelName);
                    el = playerToReplace.element;
                } else {
                    // create a new player
                    el = embedTwitch(channelName, widthAndHeight).element;
                };
            }

            var pos = indexToPositionInTable(j, defaultStreamsToShowCount);
            var percentX = (percentOfWindow * pos.x) + "%";
            var percentY = (percentOfWindow * pos.y) + "%";
            el.style.left = percentX;
            el.style.top = percentY;
        }
        
        // Remove excess channels
        /*for(var k = 0; k < players.length; k++) {
            if(players[k].isOnline())
                continue;
            previousElements[k].remove();
        }*/
    }

    function filterStreams(streams) {
        // Get the channels that did not recently go offline
        
        var streamsToShowCount = defaultStreamsToShowCount;
        if (defaultStreamsToShowCount > streams.length) {
            streamsToShowCount = streams.length;
        }
        var secondsItTakesTwitchApiToUpdate = 180;
        var newChannels = [];
        var now = new Date();

        for(var i = 0; i < streams.length; i++) {
            if (newChannels.length == streamsToShowCount) {
                break;
            }
            var channelName = streams[i].channel.name;
            var whenLastOffline = recentlyOffline[channelName];
            if (whenLastOffline) {
                // If this channel recently went offline then do not include it.
                // The problem is the twitch API is cached for a few minutes which can
                // cause us to show an offline stream.
                // "Delay in removing offline channels from streams API #659"
                // https://github.com/justintv/Twitch-API/issues/659
                var secondsPast = (now.getTime() - whenLastOffline.getTime()) / 1000;
                if (secondsPast < secondsItTakesTwitchApiToUpdate) {
                    continue;
                }
            }
            newChannels.push(channelName);
        }
        
        return newChannels;
    }

    function handleGameStreams(data) {
        console.log(data);
        var streams = data.streams;
        if(!streams || streams.length === 0) {
            error("No streams for this game: " + gameToShow);
            return;
        }
        streams.sort(function(a, b) {
            // most popular first
            return b.viewers - a.viewers;
        });

        var newChannels = filterStreams(streams);
        showChannels(newChannels);
        isAjaxing = false;
    }
    
    function failedAjax(err) {
        console.warn('Failed ajax:', err);
        humane.error("An error fetching streams: " + err);
        isAjaxing = false;
    }
    
    function getTopStreams() {
        if(isAjaxing)
            return;

        isAjaxing = true;
        // `encodeURIComponent` because "+" turns into " " on the twitch server side
        // so we should use %2B instead.
        var jsonUrl = "https://api.twitch.tv/kraken/streams?game=" + encodeURIComponent(gameToShow);
        // Trying to avoid the browser caching the results and causing us to show an offline stream.
        jsonUrl += "&pleasedontcache=" + Math.random();
        $.ajax({
            url: jsonUrl,
            success: handleGameStreams,
            error: failedAjax,
            headers: defaultHeaders,
            timeout: 5000,
            jsonp: false,
        });
    }
    
    function handleGamesList(data) {
        var template = $('#channelCardTemplate').html();
        var html = Mustache.render(template, data);
        $('#gameCardsContainer').html(html);
        
        // update the hrefs to the panel count
        onDataChange();
    }
    
    function showGamesCards() {
        streamsContainer.remove();
        var jsonUrl = 'https://api.twitch.tv/kraken/games/top?limit=100';
        jsonUrl += "&pleasedontcache=" + Math.random();
        $.ajax({
            url: jsonUrl,
            success: handleGamesList,
            error: failedAjax,
            headers: defaultHeaders,
            timeout: 5000,
            jsonp: false,
        });
    }
    
    function main() {
        var params = urlGetParams();
        defaultStreamsToShowCount = params.panels || 4;
        gameToShow = params.game;
        var debugChannel = params.debug;
        if (debugChannel) {
            // Debugging a specific channel to show so I can fiddle with
            // a channel going offline
            // Hook into getTopStreams to fake what the api would return
            getTopStreams = function() {
                var data = {
                    streams: [
                        {
                            channel: {
                                name: debugChannel
                            }
                        }
                    ]
                };
                handleGameStreams(data);
            };
        }

        if(gameToShow) {
            document.title = "Twitchn - " + gameToShow;
            instructionsContainer.remove();
            getTopStreams();

            // Refresh list of top streams frequently
            var threeMinutesInMs = 1000 * 60 * 3;
            setInterval(getTopStreams, threeMinutesInMs);

        } else {
            showGamesCards();
        }

        // Refresh the entire page once in a while because the twitch
        // embeds leak memory and crash the tab every 3-6 hours
        var oneHourMs = 1000 * 60 * 60;
        // reload(true) is a hard refresh
        // http://stackoverflow.com/questions/2099201/javascript-hard-refresh-of-current-page
        setTimeout(function() {window.location.reload(true);}, oneHourMs);

        // export debug functions
        mydebug.previouslyShowingChannels = function() { return previouslyShowingChannels;};
        mydebug.showChannels = showChannels;
        mydebug.getTopStreams  = getTopStreams;
    }
    
    
    main();
});

///////////////////////////////////////////////////////////////////////////////
// Functions used by html elements are on the global namespace.
// probably should clean this up one day.
///////////////////////////////////////////////////////////////////////////////
function getPanelCount() {
    return +document.getElementById("amountOfPanels").value;
}

function onDataChange() {
    var panelCount = getPanelCount();
    $('a.gameCard').each(function(index, el) {
        var game = el.getAttribute('value');
        var url = "?game=" + game + "&panels=" + panelCount;
        el.setAttribute('href', url);
    });
}
