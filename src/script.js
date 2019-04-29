const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

let lastEmailCount = 0;
let lastRefresh = new Date();
let loadedMenu = false;

const REMINDER_EMAIL_CLASS = "reminder";
const CALENDAR_EMAIL_CLASS = "calendar-event";
const CALENDAR_ATTACHMENT_CLASS = "calendar-attachment";
const AVATAR_EMAIL_CLASS = "email-with-avatar";
const AVATAR_CLASS = "avatar";
let options = {};

const nameColors = ["1bbc9b","16a086","f1c40f","f39c11","2dcc70","27ae61","d93939","d25400","3598db","297fb8","e84c3d","c1392b","9a59b5","8d44ad","bec3c7","34495e","2d3e50","95a5a4","7e8e8e","ec87bf","d870ad","f69785","9ba37e","b49255","b49255","a94136"];
const faviconDataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAuCAMAAABgZ9sFAAAA8FBMVEVHcExGbcdPds/h4eJCas01r/BVe9KCz/R/m9PY2+E/acxGbs9af9Ta290wS4x/zPXt7e9HabqYor1dt+wvU6zp6ehEar40WK1Gabfv7u3R1d1Oaaexv95iw/E6su6Bz/SBzfOE1fsxufY0uvY7ZMs4Yco1X8k9btjl5eTj4+NAcdlCc9o1u/gwWrcuV7EnR5c9Z82B0/kvuPcoTaktU6MvVqsnSqBYfs8zXrzJz988d9aqttIlRI85kOBIccu6wtVrzPdEvvV4wfBAbcJvi9A4n+c+gttioN1FXZdYxfZciNJ/l9V/ja5tr+gnQoZUkt+J5e8pAAAAIXRSTlMAq3f96P1Kvw/9+s4oiP76FJH9c+ilUdMpUjv9v8CwwLBmLZScAAACG0lEQVRIx43SaXeaQBQGYFywqFm0Jt3bdFhGoEalqGisZtGaxqTp//83vZcZYIBBec/x2zN33juiKLI0ut2GUjZatW5Z9apWTp9UWhaltFU5KaMbbdNCTq12VKjzsXOoiMU85YU6l7VTrbCIlXgTC3UuHUfuG+2xKXJK2w3ttOY4TvOTrIhpZjitfwl1fjoUMfP8uSnXWMRMfKTls6HIWMLZ7Jeulisy5lwsw/XrWeVDtgjX6yDhW9S1l9dfo9H7d+kX4U3Wy+aWci7o0ewiKsRfhGvHZh61DfrtWahnsykrFL8IZluzHXuxB0/3i5T2fR8LwTeSaJzugA8oDVA7ovb9i6oSflExtzbcyzR45Wacznppow/1EnRkh5iNoq5u3B9C3OAWPf6Wf0aTyWQ6HF5D5vP55vFcGQzUneBdtx96nM0046CDB0KAD4zf8QWuG3n7Nq03jx5hHC5YuS6zyNGn9fV8D6ORG8YgvGDXjzX4RVqv/3ok4uwArswx+s+ChhUJETg7ASv349BppMMVsxxPwMqJN6dMsxUlHKKuBA9/S7yinBviBaawYhHHlSPfSlYs4njBjul/DyQXRdczWtd1vGCX7RFxPTmh86gr2eiYZ3N/55HS3HgqwDJu3N8RUpoX9pDxAz0k/FCPHD82GvnPUiuyeMDDHFuRac/jvEQPxlWcfbwH0+dKTy03OtQ9Ret9+/qmVK6+97T/W3MEXFqJ8TYAAAAASUVORK5CYII=";

/* remove element */
Element.prototype.remove = function() {
	this.parentElement.removeChild(this);
};

const getMyEmailAddress = function () {
	const accountInfo = document.querySelector("div[aria-label='Account Information']");
	if (accountInfo) {
		for (const child of accountInfo.getElementsByTagName("*")) {
			if (child.children.length > 0) continue;
			const emailMatch = (child.innerText || "").match(emailRegex);
			if (emailMatch) return emailMatch[0];
		}
	}

	return "";
};

const triggerMouseEvent = function (node, event) {
	const mouseUpEvent = document.createEvent("MouseEvents");
	mouseUpEvent.initEvent(event, true, true);
	node.dispatchEvent(mouseUpEvent);
};

const waitForElement = function (selector, callback, tries) {
	if (typeof tries == "undefined") tries = 100;

	const element = document.querySelector(selector);
	if (element) {
		callback(element);
	} else if (tries > 0) {
		setTimeout(() => waitForElement(selector, callback, tries - 1), 100);
	}
};

const getEmailParticipants = function (email) {
	return email.querySelectorAll(".yW span[email]");
};

const isReminder = function(email, myEmailAddress) {
	if(options.reminderTreatment === "none") {
		return false; // if user doesn't want reminders treated special, then just return as though current email is not a reminder
	}

	const nameNodes = getEmailParticipants(email);
	let allNamesMe = true;

	for (const nameNode of nameNodes) {
		if (nameNode.getAttribute("email") !== myEmailAddress) {
			allNamesMe = false;
		}
	}

	if(options.reminderTreatment === "all") {
		return allNamesMe;
	} else if(options.reminderTreatment === "containing-word") {
		const titleNode = email.querySelector(".y6");
		return allNamesMe && titleNode && titleNode.innerText.match(/reminder/i);
	}

	return false;
};

const isCalendarEvent = function(email) {
	const node = email.querySelector(".aKS .aJ6");
	return node && node.innerText === "RSVP";
};

const addDateLabel = function (email, label) {
	if (email.previousSibling && email.previousSibling.className === "time-row") {
		if(email.previousSibling.innerText === label) {
			return;
		}
		email.previousSibling.remove();
	}

	const timeRow = document.createElement("div");
	timeRow.classList.add("time-row");
	const time = document.createElement("div");
	time.className = "time";
	time.innerText = label;
	timeRow.appendChild(time);

	email.parentElement.insertBefore(timeRow, email);
};

const getDate = function(email) {
    const dateElement = email.querySelector(".xW.xY span");
    if(dateElement) {
		return new Date(dateElement.getAttribute("title"));
	}
};

const buildDateLabel = function(email) {
	let now = new Date();
	let date = getDate(email);

	if(date === undefined) {
		return;
	}

	if(now.getFullYear() == date.getFullYear()) {
		if(now.getMonth() == date.getMonth()) {
			if(now.getDate() == date.getDate()) { return "Today"; }
			if(now.getDate()-1 == date.getDate()) { return "Yesterday"; }
			return "This month";
		}
		return months[date.getMonth()];
	}
	if(now.getFullYear()-1 == date.getFullYear()) { return "Last year"; }

	return date.getFullYear().toString();
};

const cleanupDateLabels =  function() {
    document.querySelectorAll(".time-row").forEach(row => {
    	// delete any back to back date labels
    	if(row.nextSibling && row.nextSibling.className === "time-row") {
    		row.remove();
		}
	});
};

const addEventAttachment = function(email) {
	let title = "Calendar Event";
	let time = "";
	const titleNode = email.querySelector(".bqe,.bog");
	if(titleNode) {
		const titleFullText = titleNode.innerText;
		let matches = Array.from(titleFullText.matchAll(/[^:]*: ([^@]*)@(.*)/g))[0];
		if (matches) {
			title = matches[1].trim();
			time = matches[2].trim();
		}
	}

	//build calendar attachment, this is based on regular attachments we no longer
	// have access to inbox to see the full structure
	const span = document.createElement("span");
	span.appendChild(document.createTextNode("Attachment"));
	span.classList.add("bzB");

	const attachmentNameSpan = document.createElement("span");
	attachmentNameSpan.classList.add("event-title");
	attachmentNameSpan.appendChild(document.createTextNode(title));

	const attachmentTimeSpan = document.createElement("span");
	attachmentTimeSpan.classList.add("event-time");
	attachmentTimeSpan.appendChild(document.createTextNode(time));

	const attachmentContentWrapper = document.createElement("span");
	attachmentContentWrapper.classList.add("brg");
	attachmentContentWrapper.appendChild(attachmentNameSpan);
	attachmentContentWrapper.appendChild(attachmentTimeSpan);

	//find Invitation Action
	const action = email.querySelector(".aKS");
	if(action) {
		attachmentContentWrapper.appendChild(action);
	}

	const imageSpan = document.createElement("span");
	imageSpan.classList.add("calendar-image");

	const attachmentCard = document.createElement("div");
	attachmentCard.classList.add("brc");
	attachmentCard.setAttribute("role", "listitem");
	attachmentCard.setAttribute("title", title);
	attachmentCard.appendChild(imageSpan);
	attachmentCard.appendChild(attachmentContentWrapper);

	const attachmentNode = document.createElement('div');
	attachmentNode.classList.add("brd", CALENDAR_ATTACHMENT_CLASS);
	attachmentNode.appendChild(span);
	attachmentNode.appendChild(attachmentCard);

	const emailSubjectWrapper = email.querySelectorAll(".a4W");
	if(emailSubjectWrapper) {
		emailSubjectWrapper[0].appendChild(attachmentNode);
	}
};

function reloadOptions() {
	chrome.runtime.sendMessage({method: "getOptions"}, function(ops) {
		options = ops;
	});
}

const updateReminders = function () {
	reloadOptions();
	const emails = document.querySelectorAll(".zA");
	const myEmail = getMyEmailAddress();
	let lastLabel = null;

	cleanupDateLabels();

	for (const email of emails) {
		if (isReminder(email, myEmail) && !email.classList.contains(REMINDER_EMAIL_CLASS)) { // skip if already added class
			const subject = email.querySelector(".y6");
			if (subject && subject.innerText.toLowerCase().trim() == "reminder") {
				subject.outerHTML = "";
				email.querySelectorAll(".Zt").forEach(node => node.outerHTML = "");
				email.querySelectorAll(".y2").forEach(node => node.style.color = "#202124");
			}
			email.querySelectorAll(".yP,.zF").forEach(node => { node.innerHTML = "Reminder";});

			const targetElement = email.querySelector(".oZ-x3");
			if (targetElement && targetElement.getElementsByClassName(AVATAR_CLASS).length == 0) {
				const avatarElement = document.createElement("div");
				avatarElement.className = AVATAR_CLASS;
				avatarElement.style.background = "url('//ssl.gstatic.com/bt/C3341AA7A1A076756462EE2E5CD71C11/2x/ic_reminder_blue_24dp_r2_2x.png')";
				targetElement.appendChild(avatarElement);
			}

			email.classList.add(REMINDER_EMAIL_CLASS);
		} else if (!email.classList.contains(REMINDER_EMAIL_CLASS) && !email.classList.contains(AVATAR_EMAIL_CLASS)) {
			const participants = [...getEmailParticipants(email)];	// convert to array to filter
			const excludingMe = participants.filter(node => 
				node.getAttribute("email") !== myEmail && 
				node.getAttribute("name")
			);

			let firstParticipant = participants[0];
			if (excludingMe.length > 0) { // if there are others in the participant, use one of their initials instead
				firstParticipant = excludingMe[0];
			}

			const name = firstParticipant.getAttribute("name");
			const firstLetter = (name && name.toUpperCase()[0]) || "-";
			const targetElement = email.querySelector(".oZ-x3");

			if (targetElement && targetElement.getElementsByClassName(AVATAR_CLASS).length == 0) {
				const avatarElement = document.createElement("div");
				avatarElement.className = AVATAR_CLASS;
				const firstLetterCode = firstLetter.charCodeAt(0);
				if (firstLetterCode >= 65 && firstLetterCode <= 90) {
					avatarElement.style.background = "#" + nameColors[firstLetterCode - 65];
				} else {
					avatarElement.style.background = "#000000";
					// Some unicode characters are not affected by 'color: white', hence this alternative
					avatarElement.style.color = "transparent";
					avatarElement.style.textShadow = "0 0 0 #ffffff";
				}

				avatarElement.innerText = firstLetter;
				targetElement.appendChild(avatarElement);
			}

			email.classList.add(AVATAR_EMAIL_CLASS);
		}

		if(isCalendarEvent(email) && !email.querySelector("." + CALENDAR_ATTACHMENT_CLASS)) {
			email.classList.add(CALENDAR_EMAIL_CLASS);
			addEventAttachment(email);
			// remove gmail calendar icon
			email.querySelector(".yf img").remove();
		}

		let label = buildDateLabel(email);
		if (label !== lastLabel) {
			addDateLabel(email, label);
			lastLabel = label;
		}
	}

	setTimeout(updateReminders, 100);
};

/*
**
**START OF LEFT MENU
**
*/

const _nodes = {};

const setupNodes = () => {
  const observer = new MutationObserver(() => {
    // menu items
    [
      { label: 'inbox',     selector: '.aHS-bnt' },
      { label: 'snoozed',   selector: '.aHS-bu1' },
      { label: 'done',      selector: '.aHS-aHO' },
      { label: 'drafts',    selector: '.aHS-bnq' },
      { label: 'sent',      selector: '.aHS-bnu' },
      { label: 'spam',      selector: '.aHS-bnv' },
      { label: 'trash',     selector: '.aHS-bnx' },
      { label: 'starred',   selector: '.aHS-bnw' },
      { label: 'important', selector: '.aHS-bns' },
      { label: 'chats',     selector: '.aHS-aHP' },
    ].map(({ label, selector }) => {
      const node = queryParentSelector(document.querySelector(selector), '.aim');
      if (node) {
        _nodes[label] = node;
      }
    });

    // others
    [
      { label: 'title',          selector: 'a[title="Gmail"]:not([aria-label])' },
      { label: 'back',           selector: '.lS'     },
      { label: 'archive',        selector: '.lR'     },
      { label: 'resportSpam',    selector: '.nN'     },
      { label: 'deleteMail',     selector: '.bvt'    },
      { label: 'markUnread',     selector: '.uUQygd' },
      { label: 'moveTo',         selector: '.ns'     },
      { label: 'addLabel',       selector: '.mw'     },
      { label: 'more',           selector: '.nf'     },
      { label: 'messageSection', selector: '.Bs'     },
    ].map(({ label, selector }) => {
      const node = document.querySelector(selector);
      if (node) {
        _nodes[label] = node;
      }
    });
  });
  observer.observe(document.body, { subtree: true, childList: true });
};

const reorderMenuItems = () => {
  const observer = new MutationObserver(() => {
    const parent = document.querySelector('.wT .byl');
    const refer = document.querySelector('.wT .byl>.TK');
    const {
      inbox, snoozed, done, drafts, sent,
      spam, trash, starred, important, chats,
    } = _nodes;

    if (
      parent && refer && loadedMenu &&
      inbox && snoozed && done && drafts && sent &&
      spam && trash && starred && important && chats
    ) {
      /* Gmail will execute its script to add element to the first child, so
       * add one placeholder for it and do the rest in the next child.
       */
      const placeholder = document.createElement('div');
      placeholder.classList.add('TK');
      placeholder.style.cssText = 'padding: 0; border: 0;';

      // Assign link href which only show archived mail
      done.querySelector('a').href = '#archive';

      // Remove id attribute from done element for preventing event override from Gmail
      done.firstChild.removeAttribute('id');

      // Manually add on-click event to done elment
      done.addEventListener('click', () => window.location.assign('#archive'));
			
      // Rewrite text from All Mail to Done
      done.querySelector('a').innerText = 'Done';

      // Change icon to green checkmark
      done.querySelector('.qj').style.backgroundImage = 'url("https://i.ibb.co/nbQZg5y/ic-done-clr-24dp-r4-2x.png")';

      // Add border seperator to bottom of Done
      const innerDone = done.querySelector('div');
      innerDone.style.borderBottom = '1px solid rgb(221, 221, 221)';
      innerDone.style.paddingBottom = '5px';
      innerDone.style.paddingTop = '5px';

      const newNode = document.createElement('div');
      newNode.classList.add('TK');
      newNode.appendChild(inbox);
      newNode.appendChild(snoozed);
      newNode.appendChild(done);
      parent.insertBefore(placeholder, refer);
      parent.insertBefore(newNode, refer);

      setupClickEventForNodes([
        inbox, snoozed, done, drafts, sent,
        spam, trash, starred, important, chats,
      ]);

      // Close More menu
      document.body.querySelector(".J-Ke.n4.ah9").click();
      observer.disconnect();
    }

    if (
      !loadedMenu && inbox
    ) {
      // Open More menu
      document.body.querySelector(".J-Ke.n4.ah9").click();
      loadedMenu = true;
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
};

const activateMenuItem = (target, nodes) => {
  nodes.map(node => node.firstChild.classList.remove('nZ'));
  target.firstChild.classList.add('nZ');
};

const setupClickEventForNodes = (nodes) => {
  nodes.map(node =>
    node.addEventListener('click', () =>
      activateMenuItem(node, nodes)
    )
  );
};

const setFavicon = () => document.querySelector('link[rel*="shortcut icon"]').href = faviconDataUri;

const init = () => {
	setFavicon();
	setupNodes();
	reorderMenuItems();
};

if (document.head) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}

const queryParentSelector = (elm, sel) => {
  if (!elm) {
    return null;
  }
  var parent = elm.parentElement;
  while (!parent.matches(sel)) {
    parent = parent.parentElement;
    if (!parent) {
      return null;
    }
  }
  return parent;
};

/*
**
**END OF LEFT MENU
**
*/

document.addEventListener("DOMContentLoaded", function(event) {
	const addReminder = document.createElement("div");
	addReminder.className = "add-reminder";
	addReminder.addEventListener("click", function (e) {
		const myEmail = getMyEmailAddress();

		const composeButton = document.querySelector(".T-I.J-J5-Ji.T-I-KE.L3");
		triggerMouseEvent(composeButton, "mousedown");
		triggerMouseEvent(composeButton, "mouseup");

		waitForElement("textarea[name='to']", to => {
			const title = document.querySelector("input[name='subjectbox']");
			const body = document.querySelector("div[aria-label='Message Body']");

			to.value = myEmail;
			title.value = "Reminder";
			body.focus();
		});
	});
	document.body.appendChild(addReminder);

	updateReminders();
});
