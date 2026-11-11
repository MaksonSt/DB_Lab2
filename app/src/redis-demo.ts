import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:56379' });

const MATCH = 'lab2:match:1';
const EVENT = 'lab2:event:1';

async function main() {
  await redis.connect();
  await cleanup();

  console.log('\n1. Рядки з TTL: кеш картки матчу');
  const card = { matchId: 1, home: 'ФК Дніпрові Вовки', away: 'ФК Степові Орли', venue: 'Центральний стадіон' };
  await redis.set(`${MATCH}:card`, JSON.stringify(card), { EX: 30 });
  console.log('GET:', JSON.parse((await redis.get(`${MATCH}:card`))!));
  console.log('TTL, с:', await redis.ttl(`${MATCH}:card`));

  console.log('\n2. Лічильники: продані квитки');
  await redis.incrBy(`${EVENT}:tickets_sold`, 120);
  await redis.incr(`${EVENT}:tickets_sold`);
  await redis.decr(`${EVENT}:tickets_sold`);
  console.log('Продано квитків:', await redis.get(`${EVENT}:tickets_sold`));

  console.log('\n3. Хеш: live-табло матчу');
  await redis.hSet(`${MATCH}:live`, { home: 0, away: 0, minute: 0, status: 'live' });
  await redis.hSet(`${MATCH}:live`, 'minute', 23);
  await redis.hIncrBy(`${MATCH}:live`, 'home', 1);
  console.log('HGETALL:', await redis.hGetAll(`${MATCH}:live`));
  console.log('HGET status:', await redis.hGet(`${MATCH}:live`, 'status'));

  console.log('\n4. Список: стрічка подій (останні 5)');
  const feed = ["7' жовта картка: Бойко", "23' гол: Кравченко", "41' заміна: Поліщук", "58' гол: Шевченко", "67' жовта картка: Поліщук", "80' гол: Кравченко"];
  for (const item of feed) await redis.lPush(`${MATCH}:feed`, item);
  await redis.lTrim(`${MATCH}:feed`, 0, 4);
  console.log('LRANGE:', await redis.lRange(`${MATCH}:feed`, 0, -1));
  console.log('LLEN:', await redis.lLen(`${MATCH}:feed`));

  console.log('\n5. Множини: хто стежить за матчами');
  await redis.sAdd(`${MATCH}:followers`, ['olena', 'ivan', 'petro']);
  await redis.sAdd('lab2:match:2:followers', ['ivan', 'oleg']);
  console.log('SCARD матч 1:', await redis.sCard(`${MATCH}:followers`));
  console.log('SISMEMBER oleg:', await redis.sIsMember(`${MATCH}:followers`, 'oleg'));
  console.log('SINTER (обидва матчі):', await redis.sInter([`${MATCH}:followers`, 'lab2:match:2:followers']));

  console.log('\n6. Відсортована множина: бомбардири турніру');
  await redis.zAdd(`${EVENT}:scorers`, [
    { score: 3, value: 'Кравченко' },
    { score: 2, value: 'Шевченко' },
    { score: 1, value: 'Бойко' },
  ]);
  await redis.zIncrBy(`${EVENT}:scorers`, 2, 'Бойко');
  console.log('ZRANGE REV WITHSCORES:', await redis.zRangeWithScores(`${EVENT}:scorers`, 0, 2, { REV: true }));
  console.log('ZREVRANK Шевченко:', await redis.zRevRank(`${EVENT}:scorers`, 'Шевченко'));
  console.log('ZSCORE Бойко:', await redis.zScore(`${EVENT}:scorers`, 'Бойко'));

  console.log('\n7. SET NX EX: тимчасове бронювання місця на 10 хв');
  const seat = `${EVENT}:seat:A-5-12`;
  console.log('olena бронює:', await redis.set(seat, 'olena', { NX: true, EX: 600 }));
  console.log('ivan бронює те саме місце:', await redis.set(seat, 'ivan', { NX: true, EX: 600 }));
  console.log('Власник:', await redis.get(seat), '| TTL, с:', await redis.ttl(seat));

  console.log('\n8. MULTI/EXEC: гол атомарно оновлює табло, стрічку і бомбардирів');
  const results = await redis
    .multi()
    .hIncrBy(`${MATCH}:live`, 'home', 1)
    .hSet(`${MATCH}:live`, 'minute', 85)
    .lPush(`${MATCH}:feed`, "85' гол: Бойко")
    .zIncrBy(`${EVENT}:scorers`, 1, 'Бойко')
    .exec();
  console.log('EXEC:', results);
  console.log('Табло:', await redis.hGetAll(`${MATCH}:live`));

  console.log('\n9. Pub/Sub: трансляція голів підписникам');
  const subscriber = redis.duplicate();
  await subscriber.connect();
  const received = new Promise<string>((resolve) => {
    subscriber.subscribe(`${MATCH}:goals`, (message) => resolve(message));
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const listeners = await redis.publish(`${MATCH}:goals`, JSON.stringify({ minute: 90, scorer: 'Шевченко', score: '3:0' }));
  console.log('Отримувачів:', listeners, '| повідомлення:', JSON.parse(await received));
  await subscriber.unsubscribe();
  await subscriber.quit();

  console.log('\n10. SCAN: ключі демо');
  const keys: string[] = [];
  for await (const batch of redis.scanIterator({ MATCH: 'lab2:*', COUNT: 100 })) keys.push(...batch);
  console.log(keys.sort());
  await cleanup();
}

async function cleanup() {
  for await (const batch of redis.scanIterator({ MATCH: 'lab2:*', COUNT: 100 })) {
    if (batch.length) await redis.del(batch);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => redis.quit());
