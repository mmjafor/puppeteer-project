/* import keywords from './config/keywords.cjs';
import PQueue from 'p-queue';
import dataFetcher from './dataFetcher.js';


const concurrencyLimit = 5; // Change this to 1 if you want to run one at a time
const queue = new PQueue({ concurrency: concurrencyLimit });

for (const category in keywords) {
  console.log(`Category: ${category}`); // Print the category name
  
  for (const item of keywords[category]) {
    console.log(`  Item: ${item}`); // Print each item in the array
    
    queue.add(() => dataFetcher(item, category)); // Add the task to the queue
  }
}

// Wait for the queue to complete
queue.onIdle().then(() => {
  console.log('All tasks completed');
}); */

/* import keywords from './config/keywords.cjs';
import PQueue from 'p-queue';
import dataFetcher from './dataFetcher.js';
import fs from 'fs';

const concurrencyLimit = 5;
const queue = new PQueue({ concurrency: concurrencyLimit });

const loadCheckpoint = () => {
  try {
    const rawData = fs.readFileSync('checkpoint.json');
    return JSON.parse(rawData);
  } catch (error) {
    return null;
  }
};

const checkpoint = loadCheckpoint();

for (const category in keywords) {
  console.log(`Category: ${category}`); // Print the category name

  for (const item of keywords[category]) {
    console.log(`  Item: ${item}`); // Print each item in the array

    if (checkpoint && checkpoint.category === category && checkpoint.item === item) {
      queue.add(() => dataFetcher(item, category, checkpoint.currentPage));
    } else {
      queue.add(() => dataFetcher(item, category));
    }
  }
}

queue.onIdle().then(() => {
  console.log('All tasks completed');
}); */

import keywords from './config/keywords.cjs';
import PQueue from 'p-queue';
import dataFetcher from './dataFetcher.js';
import fs from 'fs';

const concurrencyLimit = 5;
const queue = new PQueue({ concurrency: concurrencyLimit });

const loadCheckpoint = () => {
  try {
    const rawData = fs.readFileSync('checkpoint.json');
    return JSON.parse(rawData);
  } catch (error) {
    return null;
  }
};

const checkpoint = loadCheckpoint();

for (const category in keywords) {
  console.log(`Category: ${category}`); // Print the category name

  for (const item of keywords[category]) {
    console.log(`  Item: ${item}`); // Print each item in the array

    if (checkpoint && checkpoint.category === category && checkpoint.item === item) {
      queue.add(() => dataFetcher(item, category, checkpoint.currentPage));
    } else {
      queue.add(() => dataFetcher(item, category));
    }
  }
}

queue.onIdle().then(() => {
  console.log('All tasks completed');
});