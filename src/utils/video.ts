
export   function startPlayingAndWaitForVideo(video:HTMLVideoElement) {
    return new Promise((resolve:(...args:any[])=>void, reject) => {
      video.addEventListener('error', reject);
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(resolve);
      } else {
        const timeWatcher = () => {
          if ((video as HTMLVideoElement).currentTime > 0) {
            resolve();
          } else {
            requestAnimationFrame(timeWatcher);
          }
        };
        timeWatcher();
      }
      video.play().catch(reject);
    });
  }