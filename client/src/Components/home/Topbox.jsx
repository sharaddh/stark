import React from 'react'
import delevery from '../../assets/delivery.png'
import cod from '../../assets/cod.png'
import reee from '../../assets/return.png'
function Topbox() {
  return (
    <>
      <div className="relative w-full h-14 z-10 mb-4 flex items-end justify-end px-2">
        <div
          className="absolute flex items-center justify-center gap-2 sm:gap-4 w-[60%] sm:w-[58%] h-full bg-gray-50 bg-contain bg-no-repeat bg-center rounded-2xl shadow-[0px_0px_20px_-12px_rgba(0,0,0,1)]"
        >
          <img className="h-16 sm:h-[70px]" src={reee} alt="" />
          <img className="h-14 sm:h-[68px]" src={delevery} alt="" />
          <img className="h-16 sm:h-[70px]" src={cod} alt="" />
        </div>
      </div>
    </>
  )
}

export default Topbox