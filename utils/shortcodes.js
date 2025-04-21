const READING_SPEED = 300;

const readingTime = (content) => {
  const sanitizeHtml = content.replace(/<\/?[^>]+(>|$)/g, "");
  const numWords = sanitizeHtml.split(" ").length;
  const minutes = Math.round(numWords / READING_SPEED);
  const text = minutes < 1 ? 1 : minutes;

  return `<div class="px-2 bg-okta-cloud rounded-xl content-center font-bold"><p class="text-xs leading-3 uppercase">${text} min read</p></div>`;
};

export default {
  readingTime: (content) => readingTime(content),
};
