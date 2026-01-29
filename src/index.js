import 'dotenv/config';
import createApp from './app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
});
