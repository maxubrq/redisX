import { Resp3Parser } from './dist/index.js';

const onReply = (value) => {
  console.log('onReply called:', JSON.stringify(value, null, 2));
};

const onError = (error) => {
  console.log('onError called:', error.message);
};

const parser = new Resp3Parser({ onReply, onError });

// Test simple array first
console.log('=== Testing simple array ===');
const simpleData = Buffer.from('*1\r\n+test\r\n');
console.log('Data:', simpleData.toString());
parser.feed(simpleData);

// Reset parser
const parser2 = new Resp3Parser({ onReply, onError });

// Test nested array
console.log('\n=== Testing nested array ===');
const nestedData = Buffer.from('*1\r\n*1\r\n+inner\r\n');
console.log('Data:', nestedData.toString());
parser2.feed(nestedData);
