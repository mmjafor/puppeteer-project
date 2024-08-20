/* import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteerExtra.use(StealthPlugin());

const urlFriendlyString = (originalString) => encodeURIComponent(originalString).replace(/%20/g, "+").toLowerCase();

const saveCheckpoint = (category, item, currentPage) => {
  const checkpoint = { category, item, currentPage };
  fs.writeFileSync('checkpoint.json', JSON.stringify(checkpoint, null, 2));
};

const loadCheckpoint = () => {
  try {
    const rawData = fs.readFileSync('checkpoint.json');
    return JSON.parse(rawData);
  } catch (error) {
    return null;
  }
};

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const saveDataInChunks = (data, category, item, chunkSize = 1000) => {
  ensureDirectoryExists('output');
  const totalChunks = Math.ceil(data.length / chunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
    const fileName = path.join('output', `${category}_${item}_chunk_${i + 1}.json`);
    fs.writeFileSync(fileName, JSON.stringify(chunk, null, 2));
  }
};

const scrapeCourseData = async (page, course, category, item) => {
  try {
    await page.goto(course.link, { waitUntil: 'load', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 6000)); // Allow time for the page to load fully

    const courseData = await page.evaluate((course, category, item) => {
      const keyword = item;
      const getTextContent = (selector) => document.querySelector(selector)?.textContent.trim() || null;
      const getSrc = (selector) => document.querySelector(selector)?.src || null;

      const name = getTextContent('h1.clp-lead__title');
      const image = getSrc('#main-content-anchor img');
      const url = window.location.href;
      const price = course?.price || 'N/A';
      const short_desc = getTextContent('.clp-lead__headline');
      const long_desc = getTextContent('.styles--description--AfVWV');
      const user_rating = getTextContent('.star-rating-module--rating-number--2-qA2');
      const user_rating_count = getTextContent('.clp-lead__element-item--row > a > span:nth-child(2)');
      const language = getTextContent('.clp-lead__locale');
      const total_enrolled = getTextContent('.clp-lead__badge-ratings-enrollment > div');
      const vendor = 'Udemy';
      const level = course?.level || 'N/A';
      const prerequisites = Array.from(document.querySelectorAll('h2.ud-heading-xl.requirements--title--eo3-L + ul li div.ud-block-list-item-content')).map(el => el.textContent.trim());
      const time_to_complete = course?.estimatedTimeElement || 'N/A';
      const provided_by = course?.providedByElement || 'N/A';

      const modules = Array.from(document.querySelectorAll('.accordion-panel-module--panel--Eb0it')).map(el => {
        const moduleName = el.querySelector('.section--section-title-container--Hd9vI > button > span > span')?.textContent || 'No module name';
        const moduleLectureCount = el.querySelector('.section--section-title-container--Hd9vI > button > span > span.section--section-content--2mUJ7')?.textContent || 'No lecture count';
        const lessons = Array.from(el.querySelectorAll('.accordion-panel-module--content--0dD7R')).map(lesson => {
          const lessonName = lesson.querySelector('.section--item-title--EWIuI')?.textContent || '';
          const lessonTime = lesson.querySelector('.section--item-content-summary--Aq9em')?.textContent || '';
          return { lessonName, lessonTime };
        });
        return { moduleName, moduleLectureCount, lessons };
      });

      return {
        name, image, url, price, short_desc, long_desc, user_rating, user_rating_count, language,
        total_enrolled, vendor, prerequisites, level, time_to_complete, category, keyword, provided_by, modules
      };
    }, course, category, item);

    console.log(courseData);
    return courseData;

  } catch (error) {
    console.error('Error scraping course data:', error);
    return null;
  }
};

const dataFetcher = async (item, category, startPage = 1, verbose = false) => {
  try {
    const checkpoint = loadCheckpoint();
    if (checkpoint && checkpoint.category === category && checkpoint.item === item) {
      startPage = checkpoint.currentPage;
    }

    const browser = await puppeteerExtra.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.udemy.com/', { waitUntil: 'load', timeout: 0 });
    await page.setViewport({ width: 1080, height: 1024 });
    await page.type('input[type=text]', item, { delay: 100 });
    await page.keyboard.press('Enter');
    if (verbose) console.log('Searching for courses...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

    let hasNextPage = true;
    let currentPage = startPage;
    let allCourseData = [];

    while (hasNextPage) {
      if (verbose) console.log(`Scraping page ${currentPage}...`);

      let courseLinks = await page.$$eval('.course-card-module--container--3oS-F', (cards) => {
        if (cards.length > 0) {
          return cards.map(card => {
            const linkElement = card.querySelector('.course-card-title-module--title--W49Ap a');
            const levelElement = card.querySelector('.course-card-details-module--course-meta-info--2bDQt span:nth-child(3)');
            const priceElement = card.querySelector('.base-price-text-module--price-part---xQlz span span');
            const estimatedTimeElement = card.querySelector('.course-card-details-module--course-meta-info--2bDQt span:nth-child(1)');
            const providedByElement = card.querySelector('.course-card-instructors-module--instructor-list--cJTfw');

            return {
              link: linkElement ? linkElement.href : null,
              level: levelElement ? levelElement.textContent.trim() : 'N/A',
              price: priceElement ? priceElement.textContent.trim() : 'N/A',
              estimatedTimeElement: estimatedTimeElement ? estimatedTimeElement.textContent.trim() : 'N/A',
              providedByElement: providedByElement ? providedByElement.textContent.trim() : 'N/A'
            };
          });
        } else {
          return [];
        }
      });

      if (courseLinks.length === 0) break;

      for (const course of courseLinks) {
        if (verbose) console.log(`Scraping course: ${course.link}`);

        const courseData = await scrapeCourseData(page, course, category, item);

        if (courseData) {
          allCourseData.push(courseData);
        }

        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5000) + 5000)); // Random delay between scrapes
      }

      saveDataInChunks(allCourseData, category, item);
      saveCheckpoint(category, item, currentPage);

      try {
        const nextPageSelector = 'pagination-module--next--QX6nm';
        const isNextPageDisabled = await page.$eval(nextPageSelector, (btn) => btn.disabled);

        if (!isNextPageDisabled) {
          await page.click(nextPageSelector);
          await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
          currentPage++;
        } else {
          hasNextPage = false;
        }

      } catch (error) {
        console.error('Error navigating to the next page:', error);
        hasNextPage = false;
      }
    }

    await browser.close();
  } catch (error) {
    console.error('Error in dataFetcher:', error);
    saveCheckpoint(category, item, startPage);
  }
};

export default dataFetcher; */

import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteerExtra.use(StealthPlugin());

const urlFriendlyString = (originalString) => encodeURIComponent(originalString).replace(/%20/g, "+").toLowerCase();

const saveCheckpoint = (category, item, currentPage) => {
  const checkpoint = { category, item, currentPage };
  fs.writeFileSync('checkpoint.json', JSON.stringify(checkpoint, null, 2));
};

const loadCheckpoint = () => {
  try {
    const rawData = fs.readFileSync('checkpoint.json');
    return JSON.parse(rawData);
  } catch (error) {
    return null;
  }
};

const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const saveDataInChunks = (data, category, item, chunkSize = 1000) => {
  ensureDirectoryExists('output');
  const totalChunks = Math.ceil(data.length / chunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunk = data.slice(i * chunkSize, (i + 1) * chunkSize);
    const fileName = path.join('output', `${category}_${item}_chunk_${i + 1}.json`);
    fs.writeFileSync(fileName, JSON.stringify(chunk, null, 2));
  }
};

const scrapeCourseData = async (page, course, category, item) => {
  try {
    await page.goto(course.link, { waitUntil: 'load', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 6000)); // Allow time for the page to load fully

    const courseData = await page.evaluate((course, category, item) => {
      const keyword = item;
      const getTextContent = (selector) => document.querySelector(selector)?.textContent.trim() || null;
      const getSrc = (selector) => document.querySelector(selector)?.src || null;

      const name = getTextContent('h1.clp-lead__title');
      const image = getSrc('#main-content-anchor img');
      const url = window.location.href;
      const price = course?.price || 'N/A';
      const short_desc = getTextContent('.clp-lead__headline');
      const long_desc = getTextContent('.styles--description--AfVWV');
      const user_rating = getTextContent('.star-rating-module--rating-number--2-qA2');
      const user_rating_count = getTextContent('.clp-lead__element-item--row > a > span:nth-child(2)');
      const language = getTextContent('.clp-lead__locale');
      const total_enrolled = getTextContent('.clp-lead__badge-ratings-enrollment > div');
      const vendor = 'Udemy';
      const level = course?.level || 'N/A';
      const prerequisites = Array.from(document.querySelectorAll('h2.ud-heading-xl.requirements--title--eo3-L + ul li div.ud-block-list-item-content')).map(el => el.textContent.trim());
      const time_to_complete = course?.estimatedTimeElement || 'N/A';
      const provided_by = course?.providedByElement || 'N/A';

      const modules = Array.from(document.querySelectorAll('.accordion-panel-module--panel--Eb0it')).map(el => {
        const moduleName = el.querySelector('.section--section-title-container--Hd9vI > button > span > span')?.textContent || 'No module name';
        const moduleLectureCount = el.querySelector('.section--section-title-container--Hd9vI > button > span > span.section--section-content--2mUJ7')?.textContent || 'No lecture count';
        const lessons = Array.from(el.querySelectorAll('.accordion-panel-module--content--0dD7R')).map(lesson => {
          const lessonName = lesson.querySelector('.section--item-title--EWIuI')?.textContent || '';
          const lessonTime = lesson.querySelector('.section--item-content-summary--Aq9em')?.textContent || '';
          return {
            lessonName,
            lessonTime
          };
        });
        return { moduleName, moduleLectureCount, lessons };
      });

      return {
        name, image, url, price, short_desc, long_desc, user_rating, user_rating_count, language,
        total_enrolled, vendor, prerequisites, level, time_to_complete, category, keyword, provided_by, modules
      };
    }, course, category, item);

    console.log(courseData);
    return courseData;

  } catch (error) {
    console.error('Error scraping course data:', error);
    return null;
  }
};

const dataFetcher = async (item, category, startPage = 1, verbose = false) => {
  try {
    const checkpoint = loadCheckpoint();
    if (checkpoint && checkpoint.category === category && checkpoint.item === item) {
      startPage = checkpoint.currentPage;
    }

    const browser = await puppeteerExtra.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://www.udemy.com/', { waitUntil: 'load', timeout: 0 });
    await page.setViewport({ width: 1080, height: 1024 });
    await page.type('input[type=text]', item, { delay: 100 });
    await page.keyboard.press('Enter');
    if (verbose) console.log('Searching for courses...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

    let hasNextPage = true;
    let currentPage = startPage;
    let allCourseData = [];

    while (hasNextPage) {
      if (verbose) console.log(`Scraping page ${currentPage}...`);

      let courseLinks = await page.$$eval('.course-card-module--container--3oS-F', (cards) => {
        if (cards.length > 0) {
          return cards.map(card => {
            const linkElement = card.querySelector('.course-card-title-module--title--W49Ap a');
            const levelElement = card.querySelector('.course-card-details-module--course-meta-info--2bDQt span:nth-child(3)');
            const priceElement = card.querySelector('.base-price-text-module--price-part---xQlz span span');
            const estimatedTimeElement = card.querySelector('.course-card-details-module--course-meta-info--2bDQt span:nth-child(1)');
            const providedByElement = card.querySelector('.course-card-instructors-module--instructor-list--cJTfw');

            return {
              link: linkElement ? linkElement.href : null,
              level: levelElement ? levelElement.textContent.trim() : null,
              price: priceElement ? priceElement.textContent.trim() : null,
              estimatedTimeElement: estimatedTimeElement ? estimatedTimeElement.textContent.trim() : null,
              providedByElement: providedByElement ? providedByElement.textContent.trim() : null
            };
          });
        } else {
          return [];
        }
      });

      if (courseLinks.length === 0) break;

      for (const course of courseLinks) {
        if (verbose) console.log(`Scraping course: ${course.link}`);

        const courseData = await scrapeCourseData(page, course, category, item);

        if (courseData) {
          allCourseData.push(courseData);
        }

        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5000) + 5000)); // Random delay between scrapes
      }

      saveDataInChunks(allCourseData, category, item);
      saveCheckpoint(category, item, currentPage);

      try {
        currentPage++;
        const nextPageUrl = `https://www.udemy.com/courses/search/?kw=${urlFriendlyString(item)}&p=${currentPage}&src=sac`;
        await page.goto(nextPageUrl, { waitUntil: 'load', timeout: 60000 });
        await new Promise(resolve => setTimeout(resolve, 30000)); // Wait to ensure the page is fully loaded
        if (verbose) console.log('Current page URL:', page.url());
      } catch (error) {
        console.error('Error navigating to the next page:', error);
        hasNextPage = false;
      }
    }

    await browser.close();
  } catch (error) {
    console.error('Error in dataFetcher:', error);
    saveCheckpoint(category, item, startPage);
  }
};

export default dataFetcher;
