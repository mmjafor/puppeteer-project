import fs from 'fs';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';


puppeteerExtra.use(StealthPlugin());

const urlFriendlyString = (originalString) => encodeURIComponent(originalString).replace(/%20/g, "+").toLowerCase();

const dataFetcher = async (item, category) => {
  try {
    // Launch the browser
    const browser = await puppeteerExtra.launch({ headless: false });
    const page = await browser.newPage();
    
    // Go to Udemy
    await page.goto('https://www.udemy.com/', { waitUntil: 'load', timeout: 0 });

    // Set screen size
    await page.setViewport({ width: 1080, height: 1024 });

    // Type into the search box
    await page.type('input[type=text]', item, { delay: 100 });
    await page.keyboard.press('Enter');
    console.log('Searching for courses...');

    // Wait for the search results page to load
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });

    const coursesData = [];
    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
      console.log(`Scraping page ${currentPage}...`);

      let courseLinks = await page.$$eval('.course-card-module--container--3oS-F', (cards) => {
        if(cards.length > 0){
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
        }else{
          hasNextPage = false;
          return null;
        }
      });
      console.log("courses:", courseLinks);
      if(courseLinks === null || courseLinks.length === 0){
        break;
      }

      // Loop through each course link and extract data
      for (const course of courseLinks) {
        console.log(`Scraping course: ${course.link}`);
        let retries = 0;
        const maxRetries = 3;
        
        while (retries < maxRetries) {
          try {
            await page.goto(course.link, { waitUntil: 'load', timeout: 60000 });
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            const courseData = await page.evaluate((course, category, item) => {
              const keyword = item;
              const getTextContent = (selector) => document.querySelector(selector)?.textContent.trim() || null;
              const getSrc = (selector) => document.querySelector(selector)?.src || null;
        
              const name = getTextContent('h1.clp-lead__title');
              const image = getSrc('#main-content-anchor > div.sidebar-container-position-manager > div.course-landing-page_sidebar-container > div.sidebar-container--content--V-bFw > div > div.sidebar-container--introduction-asset--CD5Yt > div > div > button > span.intro-asset--img-aspect--3gluH > img');
              const url = window.location.href;
              const price = course?.price;
              const short_desc = getTextContent('#main-content-anchor > div.top-container.dark-background > div > div > div:nth-child(3) > div > div.ud-text-md.clp-lead__headline');
              const long_desc = getTextContent('#main-content-anchor > div.paid-course-landing-page__body > div > div.ud-text-sm.component-margin.styles--description--AfVWV');
              const user_rating = getTextContent('#main-content-anchor > div.top-container.dark-background > div > div > div:nth-child(3) > div > div.clp-lead__badge-ratings-enrollment > div.clp-lead__element-item.clp-lead__element-item--row > a > span.star-rating-module--star-wrapper--i1cJH.star-rating-module--medium--Lpe62.star-rating-module--dark-background--jCtxH > span.ud-heading-sm.star-rating-module--rating-number--2-qA2');
              const user_rating_count = getTextContent('#main-content-anchor > div.top-container.dark-background > div > div > div:nth-child(3) > div > div.clp-lead__badge-ratings-enrollment > div.clp-lead__element-item.clp-lead__element-item--row > a > span:nth-child(2)');
              const language = getTextContent('#main-content-anchor > div.top-container.dark-background > div > div > div:nth-child(3) > div > div.clp-lead__element-meta > div.clp-lead__element-item.clp-lead__locale');
              const total_enrolled = getTextContent('#main-content-anchor > div.top-container.dark-background > div > div > div:nth-child(3) > div > div.clp-lead__badge-ratings-enrollment > div.clp-lead__element-item.clp-lead__element-item--row > div');
              const vendor = 'Udemy';
              const level = course?.level;
              const prerequisites = Array.from(document.querySelectorAll('h2.ud-heading-xl.requirements--title--eo3-L + ul li div.ud-block-list-item-content')).map(el => el.textContent.trim());
              const time_to_complete = course?.estimatedTimeElement;
              const provided_by = course?.providedByElement;

              const moduleElements = document.querySelectorAll('.accordion-panel-module--panel--Eb0it');
              console.log('Module elements found:', moduleElements);
              
              const modules = Array.from(moduleElements).map(el => {
                console.log('Module element:', el);
                const moduleName = el.querySelector('.section--section-title-container--Hd9vI > button > span > span')?.textContent || 'No module name';
                const moduleLectureCount = el.querySelector('.section--section-title-container--Hd9vI > button > span > span.section--section-content--2mUJ7')?.textContent || 'No lecture count';
                const lessons = Array.from(el.querySelectorAll('.accordion-panel-module--content--0dD7R')).map(lesson => {
                  const lessonName = lesson.querySelector('.section--row--MuPRa > span.section--item-title--EWIuI')?.textContent || '';
                  const lessonTime = lesson.querySelector('.section--item-content-summary--Aq9em')?.textContent || '';
                  return {
                    lessonName,
                    lessonTime
                  };
                });
                return {
                  moduleName,
                  moduleLectureCount,
                  lessons,

                };
              });
              
              console.log('Modules:', modules[0].lessons);
              
              
              return{
                name, image, url, price, short_desc, long_desc, user_rating, user_rating_count, language, total_enrolled, vendor, prerequisites, level, time_to_complete, category, keyword, provided_by, modules
              };
              
            }, course, category, item);

            console.log(courseData);
            coursesData.push(courseData);
            break; // Exit retry loop if successful
          } catch (error) {
            if (error.message.includes('429')) {
              retries++;
              const waitTime = 10000 * retries; // Exponential backoff
              console.log(`429 error encountered. Retrying in ${waitTime / 1000} seconds...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              console.error('Error loading course page:', error);
              break; // Exit loop on other errors
            }
          }
        }

        // Random delay between course requests
        await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5000) + 5000));
      }
      ++currentPage;
      
      await page.goto(`https://www.udemy.com/courses/search/?kw=arti&p=${currentPage}&q=${urlFriendlyString(item)}&src=sac`, { waitUntil: 'load', timeout: 60000 });

      // Wait to ensure the page is fully loaded
      await new Promise(resolve => setTimeout(resolve, 30000));
      console.log('Current page URL before click:', page.url());
    }

    //Save data to a JSON file
    // Read existing data from JSON file
    let existingData = [];
    try {
      const rawData = fs.readFileSync('output/udemy_courses.json');
      existingData = JSON.parse(rawData);
    } catch (error) {
      console.error('Error reading existing data:', error);
    }

    // Append new data to existing data
    existingData.push(...coursesData);

    // Write updated data to JSON file
    fs.writeFileSync('output/udemy_courses.json', JSON.stringify(existingData, null, 2));

    console.log('Scraping complete. Data appended to udemy_courses.json');
    console.log('Scraping complete. Data saved to udemy_courses.json');

    // Close the browser
    await browser.close();
  } catch (error) {
    console.error('Error in Puppeteer script:', error);
  }
};

export default dataFetcher;

