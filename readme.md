# Ambassador Bot
This is my attempt to fix the problem of followbots on Mastodon, while also adding some potentially useful and interesting behavior to a bot that can be run on any server.

The AmbassadorBot will live on your server and find those local toots that have earned a high number of favs relative to other local toots. It will then boost them.

The idea is that it's always boosting the 'best' tweets of the instance that it run on. Anyone who follows your instance's Ambassador will therefore get the best toots of your interest in their federated feed. No need to use followbots to systematically follow users when you can get the best of their tweets easily!

## Installation
First, you'll need to create a new account on your instance and use [the @tinysubversions extractor](http://tinysubversions.com/notes/mastodon-bot/) to get an OAuth token for it. 

This bot has to be installed on your instance server, so unless you're the admin you're not going to be able to set it up yourself. The reason for that is that the bot reads directly from your database, rather than using the API. It requires the following environment variables (and uses the provided defaults when they're missing):

```  
  DB_HOST (defaults to '/var/run/postgresql')
  DB_NAME (defaults to 'mastodon\_production')
  DB_USER (defaults to 'mastodon')
  DB_PASSWORD (defaults to '')
  INSTANCE_HOST (no default, host of your instance)
  AMBASSADOR_TOKEN (no default)
```

To install it, set your environment variables and do the following:

  git clone git@github.com:mbilokonsky/ambassador
  cd ambassador
  yarn && yarn start

It'll cycle every 15 minutes, boosting new toots that have crossed the threshold. It keeps track, in memory, of which toots have already been boosted - that way it won't spam the server trying to boost them again and again. This is a very naive cache and technically a memory leak, so I'll fix that soon, but for now it's fine (and pm2 should gracefully restart in the event of a crash).

## How does it determine what's good enough to boost?
So, this is still sort of an open question but right now I'm using the following query:

```SELECT id 
FROM statuses 
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM statuses 
  WHERE favourites_count > 1
  AND created_at > NOW() - INTERVAL '30 days'
)
AND created_at > NOW() - INTERVAL '30 days';```

It takes an average of all toots with 2 or more favs over the past 30 days. Any toot within that window that has more than that number of favs gets a boost. Note that most toots won't get 2 favs - so this is already filtering out most toots in your instance. The hope is that by averaging what's left and picking the top half we'll end up with a pretty high standard for what gets boosted, but this algorithm will be tweaked over time.

## Seriously? You want me to give this thing access to my production database?
Look, I get it - but how else do you want me to find your top tweets in a performant way? I'm not passing any user input into the database, just repeating a static query. I am not, btw, a database expert - I pieced this query together through trial-and-error and if you want to propose an optimization I am all ears.

## What's next? Can I help?
I'd love it if I could get some eyes on this - am I SQLing right? Someone wanna PR in a better 'cache' to prevent reboosting the same statuses over and over again? How do y'all feel about that threshold function? Seems like one really popular tweet would break the curve...