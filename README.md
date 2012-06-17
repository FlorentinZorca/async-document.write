async-document.write
====================

Does advertising block your web page? That's because most of them inject content by using the ancient document.write functionality.
While document.write is a no brainer way of injecting content, it does block the page until it's done and it can only work before the DOM is completely loaded.
This is trouble when your page needs to be fast, but some ad provider is slow. It is even more trouble if you want to create a one page application with advertising on it.
Even if the ad provider you're working with is willing to change to a more host page friendly version of injecting content, you still have the problem, because usually advertising works like this:

1. You include one (or more) script tags from the ad provider. 
2. This ad provider code normally already heavily use document.write to create some div, set up some variables and...include other external scripts.
3. Repeat 2. zero or more times (even six time is possible).
4. Finally an external script will include (via document.write, of course) the actual ad as a flash, link with image or whatever they think is attractive to your users.

One solution for this problem is to intercept document.write calls and process them asynchronously, while still preserving their intended destination position.
