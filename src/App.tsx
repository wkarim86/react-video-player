import './App.css'
import VideoPlayer from './component/video-player'

function App() {

  return (
    <>
      <section id="center">

        <div className='container p-8'>
          <h1>Videp Player Demo</h1>
          <div className='flex flex-col gap-4'>
            <strong>Usage</strong>
            <code className='p-8'>{`<VideoPlayer src={"https://www.pexels.com/download/video/37984252/"}
              poster={"https://images.pexels.com/videos/37984252/4k-37984252.jpeg?auto=compress&w=1200"}
            title="My video"
            date="3 days ago"
            autoPlay={false}
            showDuration={true}
            showControls={true}
            enableFloatingPlayer={true} />`}</code>
          </div>

          <div className='py-20'>
            <VideoPlayer src={"https://www.pexels.com/download/video/37984252/"}
              poster={"https://images.pexels.com/videos/37984252/4k-37984252.jpeg?auto=compress&w=1200"}
              title="Drone shot showcasing rugged mountains under a dramatic sky."
              date="6 years ago"
              autoPlay={false}
              showDuration={true}
              showControls={true}
              enableFloatingPlayer={true} />
          </div>

        </div>

      </section>

      <section id="next-steps" className='h-[800px]'>

      </section>

    </>
  )
}

export default App
