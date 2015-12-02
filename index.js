window.url = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.getMedia = navigator.getUserMedia ||
                       navigator.webkitGetUserMedia ||
                       navigator.mozGetUserMedia ||
                       navigator.msGetUserMedia;

function Streamer(options) {
  'use strict';
  console.log('init Streamer with options', options);
  var self = this;
  var width = options.width || 320;
  var height = options.height || 180;
  self.stream = null;

  function streamMedia(callback) {
    navigator.getMedia({
      audio: false,
      video: {
        optional: [
          { minHeight: height },
          { maxHeight: height },
          { minWidth: width },
          { maxWidth: width }
        ]
      }
    }, function (stream) {
      if (self.videoElement.mozSrcObject) {
        self.videoElement.mozSrcObject = stream;
      } else {
        self.videoElement.src = window.url.createObjectURL(stream);
      }

      self.videoElement.play();
      callback(null, stream);
    }, function (err) {
      callback(err);
    });
  }

  /**
  * Requests permission for using the user's camera,
  * starts reading video from the selected camera.
  */
  function startStreaming(callback) {
    self.videoElement = document.createElement('video');
    self.videoElement.autoplay = true;
    self.videoElement.setAttribute('width', width);
    self.videoElement.setAttribute('height', height);
    streamMedia(callback);
  }

  /**
  * Try to initiate video streaming.
  */
  self.startVideo = function startVideo(callback) {
    if (navigator.getMedia) {
      startStreaming(function (err, stream) {
        if (err) {
          callback(err);
        } else {

          // Keep references, for stopping the stream later on.
          self.cameraStream = stream;
          self.video = self.videoElement;
          setTimeout(function () {
            callback(null, {
              stream: self.stream,
              videoElement: self.video
            });
          }, 1200);
        }
      });
    } else {
      callback(new Error('Could not stream video'));
    }
  };

  self.stopVideo = function stopVideo() {
    if (self.cameraStream) {
      if (self.cameraStream.stop) {
        self.cameraStream.stop();
      }
      self.cameraStream.getTracks().forEach(function (track) { track.stop(); });
    }

    if (self.video) {
      self.video.pause();
      self.video.src = null;
      self.video = null;
    }
  };
}


function Recorder(options) {
  'use strict';
  console.log('init Recorder with options', options);
  var self = this;
  options = options || {};

  // This is where we change the time lapse count
  self.videoFrames = [];

  var pendingFrames = options.frames || 10;
  var interval = options.interval || 200;
  var type = options.type || 'image/jpeg';
  var quality = type === 'image/jpeg' ? options.quality || 0.4 : undefined;

  var canvas = document.createElement('canvas');
  var context = canvas.getContext('2d');
  var img = document.createElement('img');

  function captureFrame(pendingFrames, callback) {
    context.drawImage(self.video, 0, 0, canvas.width, canvas.height);
    var imgSouce = canvas.toDataURL(type, quality);
    img.src = imgSouce;

    if (pendingFrames > 0) {
      setTimeout(function saveFrame() {
        pendingFrames--;
        self.videoFrames.push(imgSouce);
        captureFrame(pendingFrames, callback);
      }, interval);
      return;
    }

    callback(true);
    self.videoFrames = [];
  }

  self.getScreenshot = function getScreenshot(callback) {
    self.videoFrames = [];
    if (self.video) {
      canvas.width = self.video.width;
      canvas.height = self.video.height;
      captureFrame(pendingFrames, callback);
    } else {
      throw new Error('Recorder has no video element');
    }
  };
}


module.exports = function WebRTC2Images(config) {
  'use strict';
  console.log('init WebRTC2Images with options', config);
  var streamer = new Streamer(config);
  var recorder = new Recorder(config);
  var self = this;
  self.preview = null;

  self.startVideo = function (callback) {
    streamer.startVideo(function (err, data) {
      if (err) {
        return callback(err);
      }
      streamer.video = data.videoElement;
      streamer.video.width = data.videoElement.width;
      streamer.video.height = data.videoElement.height;
      self.preview = streamer.video;
      self.preview.play();
      callback();
    });
  };
  self.stopVideo = function () {
    streamer.stopVideo();
  };
  self.recordVideo = function (callback) {
    recorder.video = streamer.video;
    recorder.video.play();
    recorder.getScreenshot(function () {
      callback(null, recorder.videoFrames);
    });
  };
};
