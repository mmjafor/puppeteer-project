import keywords from './config/keywords.cjs';
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
});