# Ambassador Bot
This is my attempt to fix the problem of followbots on Mastodon, while also adding some potentially useful and interesting behavior to a bot that can be run on any server.

The AmbassadorBot will live on your server and find those local toots that have earned a high number of favs relative to other local toots. It will then boost them.

The idea is that it's always boosting the 'best' toots of the instance that it run on. Anyone who follows your instance's Ambassador will therefore get the best toots of your interest in their federated feed. No need to use followbots to systematically follow users when you can get the best of their toots easily!

Furthermore, I'd love it if the idea of ambassadors caught on independently of this bot. This is my first attempt to implement the idea - it's a proof of concept I threw together in a few hours. It has exactly one setting, which is the query I documented below. It doesn't, right now, even make any attempt to keep private toots private, or respect #nobot, or anything like that - these are all features that will come. 

But there's no reason some instances couldn't have human ambassadors! Or couldn't just find a way to publish every single public toot! Or provide a random sample! The thinking behind this is really: wouldn't it be great to give communities a way to represent themselves to the world? Where they have some say in how their community projects itself?

This is my attempt to start that conversation, and I'd very much love all of your feedback! :)


## Installation

This bot has to be installed on your instance server, so unless you're the admin you're not going to be able to set it up yourself. The reason for that is that the bot reads directly from your database, rather than using the API.


### Mastodon account for the ambassador bot

First, you'll need to create a new account on your instance and use [the @tinysubversions extractor](http://tinysubversions.com/notes/mastodon-bot/) to get an OAuth token for it. 

### Creating a UNIX user for ambassador

Running ambassador as the same user as Mastodon (or worse, `root`) is
problematic, security-wise.  Thankfully, creating a new user for it is easy:

	# sudo adduser ambassador
	# sudo -u ambassador -s
	[You should now be logged in as ambassador]
	$ cd

While you are logged-in as ambassador, you can clone the source repository for it:

	git clone git@github.com:mbilokonsky/ambassador


Note: Ideally, ambassador should not get R/W access to its own sources.
      However, best practices for deploying software on servers falls outside
	  the scope of this README.


### Creating a database user for ambassador

To avoid a whole host of security issues, `ambassador` only gets (read-only)
access to a *view* of the database that only contains public toots.

So you have to start by creating the view and the PostgreSQL user for
`ambassador`:

	# pgsql -f ~ambassador/ambassador/install.sql


Note that the default setup assumes that:
- the UNIX and PostgreSQL users are both called `ambassador`;
- PostgreSQL allows [peer authentication].

If that's not the case, you can always use password authentication instead.

[peer authentication]: https://www.postgresql.org/docs/9.6/static/auth-methods.html#AUTH-PEER


### Running ambassador

It requires the following environment variables
(and uses the provided defaults when they're missing):

```  
  DB_HOST (defaults to '/var/run/postgresql')
  DB_NAME (defaults to 'mastodon_production')
  DB_USER (defaults to 'ambassador')
  DB_PASSWORD (defaults to '')
  INSTANCE_HOST (no default, host of your instance)
  AMBASSADOR_TOKEN (no default)
```

As user `ambassador`, set the environment variables and do the following:

	cd ~/ambassador
	yarn && yarn start


It'll cycle every 15 minutes, boosting new toots that have crossed the threshold. It keeps track, in memory, of which toots have already been boosted - that way it won't spam the server trying to boost them again and again.


## How does it determine what's good enough to boost?

So, this is still sort of an open question but right now I'm using the following query:

```
SELECT id 
FROM public_toots
WHERE favourites_count > (
  SELECT avg(favourites_count) 
  FROM public_toots
  WHERE 
    favourites_count > 1
    AND created_at > NOW() - INTERVAL '30 days'
)
AND created_at > NOW() - INTERVAL '5 days';
```

So we do two things here:

1. Compute our fav threshold. Grab all public toots that have received more than 1 fav over the past 30 days. Average the fav counts for those toots. This is our threshold.
2. Find any public toots created within the past five days which have received at least that many favs.

Goal here is that this sets a pretty high bar (favs over 30 days) and applies it to only the past 5 days. It's an aggressive filter, but it's also a sliding window. If you have a bunch of super popular toots on your instance, they'll skew the curve - but only for a month or so, and this will be normalized if you have a lot of activity. Generally things will even out over time.

I am not, btw, a database expert - I pieced this query together through trial-and-error and if you want to propose an optimization I am all ears.


## Seriously? You want me to give this thing access to my production database?

Ambassador only gets access to public toots (through the `public_toots` view
created in `install.sql`).

The direct database access is required to find top toots efficiently.


## What's next? Can I help?

I'd love it if I could get some eyes on this - am I SQLing right? How do y'all feel about that threshold function? Are there security issues here?


## Where is it running?

1. <a href="https://a.weirder.earth/@ambassador">A Weirder Earth!</a>
