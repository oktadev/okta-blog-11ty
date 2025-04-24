export default function(eleventyConfig) {
  eleventyConfig.addNunjucksShortcode("avatar", function (img, size = "small") {
    let width;

    switch (size) {
      case "small":
        width = 8;
        break;
      case "medium":
        width = 12;
        break;
      case "large":
        width = 16;
        break;
    }

    return `<img src="/img/${img}" class="w-${width} list-none rounded-full" />`;
  });

}
