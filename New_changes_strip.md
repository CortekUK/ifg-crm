# team msgs and instructions:
Okay Humna, I am writing a clear message right now, which I will send to you. However, I believe you will understand the context better through my voice notes. This is the client's message. First, you need to cross-verify that the initial deposits for the summer residency and university page are correctly set at 2,000 pounds. Regarding the 'Gap Year,' it is not wired or connected at all. It displays some deposit amounts for the full year and half-year, but clicking on 'deposit' simply leads to a form. After filling it out, nothing happens; the Stripe checkout page does not appear. I am also unsure if the pricing is being updated via CAMS. The Gap Year form was never connected, so we need to link it to Stripe, okay?
Now, the main thing—even before this gap year work—is how it currently works: when a visitor goes into the program through the website to make a deposit, they enter their email. Their email is then checked. If they aren't already in the pipeline—I’ve explained this whole story to you before—and they haven't paid the deposit yet, they're redirected to a form. They fill out the form first, and then they go to the Stripe checkout. Okay? If they have already paid the deposit, we stop them right there and inform them that they have already paid. And if they have filled out the form but abandoned the payment, we don't make them fill the form again; instead, we take them directly to the Stripe checkout page. This is what's happening for now. I’ll explain what we need to do next in the following message.
Okay, so now what we need to do is eliminate the middle step where the user fills out the form. When someone clicks the deposit button, a dialog box will open, just like it's doing now. The user will enter their email address. 

Now, why are we asking for that email? It's to check if this person has already paid a deposit. Currently, if they’ve already paid, we don’t allow them to proceed. However, the issue is that if they have already paid one deposit and now want to pay a second, third, or fourth one, they should be able to. So, instead of a hard restriction, we will just provide a warning: "You have already paid a £1,500 deposit on October 3rd. Do you still want to pay again?" We'll give a warning rather than stopping them or letting them through without notice. If they choose to continue, they can proceed. 

The second reason we’re collecting the email address as soon as they click the deposit button is to capture abandoned leads. For example, if they reach the Stripe page but don't complete the payment, the email we collected before the Stripe checkout will be useful. In the CRM, under the invoices section, there's an "abandoned leads" area where we can display that email. Even if we don’t have their name, the email alone will work. There is also an "abandoned payments" list where that user will appear. This way, we’ve successfully captured the abandoned lead.
Now, the next thing is that we have removed that form from the center. It doesn't matter; it will still enter the pipeline. Whether he fills the form or not, it will be included in the pipeline. 

For now, we were having the form filled so that we could create a complete contact profile, so we could get his gender, his football position, how long he has to stay, and all those things. But now the client says he doesn't want those things. 

So, what will happen is that as soon as the deposit button is clicked, it will move to Stripe checkout. It will take the email, and then it will move to the Stripe checkout page. Now, within the Stripe checkout, the fields we currently have are the cardholder's name, phone number, and email. These are three fields that Stripe can send back to us. It doesn't send us the card payment details, but it sends these three fields that we need. 

Now, we can add three more custom fields in Stripe through code. In those, we will add a field for the player's name and two other fields that I will write in the message. These fields will be added to the Stripe checkout page. As soon as he fills in all the information and proceeds with the payment, Stripe will return all these fields to me. Then, I will create his contact according to these fields. 

Even if all the information doesn't come through, the contact will still be created. Once the payment is successful and the invoice is marked as paid, the lead will automatically drop into the respective pipeline. For example, if he paid the deposit for "Summer Residency," the lead will automatically fall into the "Deposit" stage of that pipeline, showing that his deposit was successful. It should drop in automatically; I’m explaining this whole flow. 

Additionally, in our list of pipelines, that lead will also be captured within that list. Yes.
Alright, I understand that all these things are new to you, so you might face some issues with them in the beginning. Keep communicating with me so that we don't mess things up. The more you communicate now, the more context you'll develop, and we’ll be able to get it right on the first try. Also, don't move it to production until you've verified with me whether the way we've done it is correct or not.
"I’m adding all of this with an urgent status in a Notion ticket. I’ll put all the details in that ticket, okay? So you can read the details from there. And IFG’s Claude has access to Notion and to this board as well. So if you just let him know, he’ll be able to access Notion too, alright?"

# Client Asked this : 
Hi mate, agreed domain looks good just a couple of bits. I think we need to change on there and I'll follow up with them shortly.

With regards to payments for stripe:

Each program page needs a payment option to make their deposit

University page: £2000 deposit

Gap page: £6500 deposit (full year) & £4000 deposit (half year)

Summer Residency: £2000 deposit

All these need to be on the website now, the way we'd like it is we'd like a deposit payment button which directly takes them to stripe and for the amount required, at that point then then have to tick terms of conditions and then also they have to input their credentials, name, email, player name ECT

I will send you over the terms and conditions when we have them, it should be signed off shortly. Please have the payment buttons already on there though, we can add the terms and conditions later or we can send them directly with the payment received for the time being

Thanks mate

