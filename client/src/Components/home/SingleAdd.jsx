import React, { useState, useEffect, useMemo, useContext } from 'react';
import { useSwipeable } from 'react-swipeable';
import { DataContext } from '../../DataProvider';

const DEFAULT_IMAGE = 'https://your-server.com/generic-ad-placeholder.jpg';

const SingleAdd = React.memo(() => {
  const { cache } = useContext(DataContext);
  const [currentIndex, setCurrentIndex] = useState(0);

  const normalizedImages = useMemo(() => {
    const ads = cache.singleAds?.data || [];
    return ads
      .filter((img) => img && img.url && !img.disabled)
      .map((img) => ({
        url: img.url.replace(/^http:/, 'https:'),
        alt: `Single Ad ${img._id || img.url.split('/').pop()}`,
      }));
  }, [cache.singleAds]);

  const extendedImages = useMemo(() => {
    if (normalizedImages.length === 0) return [];
    return [normalizedImages[normalizedImages.length - 1], ...normalizedImages, normalizedImages[0]];
  }, [normalizedImages]);

  const displayIndex = currentIndex + 1;

  useEffect(() => {
    if (normalizedImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev === extendedImages.length - 2) {
          setTimeout(() => setCurrentIndex(1), 0);
          return prev + 1;
        }
        return prev + 1;
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [extendedImages.length, normalizedImages.length]);

  useEffect(() => {
    if (currentIndex === 0) {
      setTimeout(() => setCurrentIndex(extendedImages.length - 2), 0);
    } else if (currentIndex === extendedImages.length - 1) {
      setTimeout(() => setCurrentIndex(1), 0);
    }
  }, [currentIndex, extendedImages.length]);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      setCurrentIndex((prev) => {
        if (prev === extendedImages.length - 2) {
          setTimeout(() => setCurrentIndex(1), 0);
          return prev + 1;
        }
        return prev + 1;
      });
    },
    onSwipedRight: () => {
      setCurrentIndex((prev) => {
        if (prev === 1) {
          setTimeout(() => setCurrentIndex(extendedImages.length - 2), 0);
          return prev - 1;
        }
        return prev - 1;
      });
    },
    trackMouse: true,
    delta: 10,
    preventDefaultTouchmoveEvent: true,
  });

  const goToImage = (index) => {
    setCurrentIndex(index + 1);
  };

  if (normalizedImages.length === 0) {
    return (
      <div className="w-full mb-5 text-center">
        <p className="text-gray-500" aria-live="polite">
          No single ad images available
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-fit px-2 mb-5">
      <div className="relative w-full bg-transparent overflow-hidden drop-shadow-lg">
        <div
          className="flex w-full h-full transition-transform duration-500 ease-in-out will-change-transform"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
          {...handlers}
        >
          {extendedImages.map((image, index) => (
            <div
              key={`${image.url}-${index}`}
              className="min-w-full h-full flex items-center justify-center"
            >
              <img
                className="w-full h-full object-cover rounded-2xl scale-100 "
                src={image.url}
                alt={image.alt}
                loading="lazy"
                fetchPriority={index === currentIndex + 1 ? 'high' : 'auto'}
                onError={(e) => {
                  if (e.target.src !== DEFAULT_IMAGE) {
                    console.warn(`Failed to load ad image: ${e.target.src}`);
                    e.target.src = DEFAULT_IMAGE;
                  }
                }}
              />
            </div>
          ))}
        </div>
      </div>
      {normalizedImages.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {normalizedImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToImage(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 shadow-sm hover:scale-125 ${
                displayIndex - 1 === index
                  ? 'bg-purple-400 scale-125'
                  : 'bg-gray-300 hover:bg-gray-500/50'
              }`}
              aria-label={`Go to ad image ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default SingleAdd;