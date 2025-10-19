import { Resp3Parser } from './dist/index.js';

const onReply = (value) => {
  console.log('onReply called:', JSON.stringify(value, null, 2));
};

const onError = (error) => {
  console.log('onError called:', error.message);
};

const parser = new Resp3Parser({ onReply, onError });

// Test simple nested array
console.log('=== Testing simple nested array ===');
const data = Buffer.from('*1\r\n*1\r\n+inner\r\n');
console.log('Data:', data.toString());
parser.feed(data);
