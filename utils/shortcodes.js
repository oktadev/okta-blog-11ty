const youtube = (id, t, w, h) => {
  const width = w || 560;
  const height = h || 315;
  const title = t || "YouTube video player";

  return `<div class="grid justify-center m-4"><iframe width=${width} height=${height} src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
};

const speakerdeck = (id, width = 600) => {
  const ratio = 1.78343949044586;
  const height = Math.round(width / ratio);

  return `<div class="grid justify-center m-4"><iframe class="speakerdeck-iframe" style="border: 0px none; background: rgba(0, 0, 0, 0.1) padding-box; margin: 0px; padding: 0px; border-radius: 6px; box-shadow: rgba(0, 0, 0, 0.2) 0px 5px 40px; width: ${width}px; height: ${height}px;" src="https://speakerdeck.com/player/${id}" title="Speaker Deck" allowfullscreen="true" data-ratio="${ratio}" frameborder="0"></iframe></div>`;
};

export default {
  youtube: (id, t, w, h) => youtube(id, t, w, h),
  speakerdeck: (id, w) => speakerdeck(id, w),
};
