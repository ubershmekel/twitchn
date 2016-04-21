$(function() {
    var streamsToShow = 4;
    var streamsContainerId = "streamsContainer";

    function handleData(data) {
        console.log(data);
        var streams = data.streams;
        streams.sort(function(a, b) {
            // most popular first
            return b.viewers - a.viewers;
        });
        
        
        if (streamsToShow > streams.length)
            streamsToShow = streams.length;

        for(var i = 0; i < streamsToShow; i++) {
            console.log(streams[i].channel.name);
            var options = {
                width: "50%",
                height: "50%",
                channel: streams[i].channel.name
            };
            var player = new Twitch.Player(streamsContainerId, options);
            player.setVolume(0); // 1.0 = max
        }
    };
    
    function failedAjax(err) {
        console.log('Failed ajax:', err);
    }
    
    var jsonUrl = "https://api.twitch.tv/kraken/streams?game=Heroes%20of%20the%20Storm";
    $.ajax({
        url: jsonUrl,
        dataType: 'jsonp',
        success: handleData,
        error: failedAjax,
        timeout: 5000
    });
});