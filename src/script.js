const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const nameColors = ['1bbc9b','16a086','f1c40f','f39c11','2dcc70','27ae61','d93939','d25400','3598db','297fb8','e84c3d','c1392b','9a59b5','8d44ad','bec3c7','34495e','2d3e50','95a5a4','7e8e8e','ec87bf','d870ad','f69785','9ba37e','b49255','b49255','a94136'];

const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const REMINDER_EMAIL_CLASS = 'reminder';
const CALENDAR_EMAIL_CLASS = 'calendar-event';
const CALENDAR_ATTACHMENT_CLASS = 'calendar-attachment';
const BUNDLE_PAGE_CLASS = 'bundle-page';
const BUNDLE_WRAPPER_CLASS = 'bundle-wrapper';
const UNREAD_BUNDLE_CLASS = 'contains-unread';
const BUNDLED_EMAIL_CLASS = 'bundled-email';
const BUNDLING_OPTION_CLASS = 'email-bundling-enabled';
const UNBUNDLED_PARENT_LABEL = 'Unbundled';
const UNBUNDLED_EMAIL_CLASS = 'unbundled-email';
const AVATAR_EMAIL_CLASS = 'email-with-avatar';
const AVATAR_CLASS = 'avatar';
const AVATAR_OPTION_CLASS = 'show-avatar-enabled';

const DATE_LABELS = {
	TODAY: 'Today',
	YESTERDAY: 'Yesterday',
	THIS_MONTH: 'This month',
	LAST_YEAR: 'Last year'
};

let lastEmailCount = 0;
let lastRefresh = new Date();
let loadedMenu = false;
let labelStats = {};
let options = {};

/* remove element */
Element.prototype.remove = function () {
	this.parentElement.removeChild(this);
};

const getMyEmailAddress = function () {
	const accountInfo = document.querySelector('div[aria-label="Account Information"]');
	if (accountInfo) {
		for (const child of accountInfo.getElementsByTagName('*')) {
			if (child.children.length > 0) continue;
			const emailMatch = (child.innerText || '').match(emailRegex);
			if (emailMatch) return emailMatch[0];
		}
	}

	return '';
};

const getEmailParticipants = function (email) {
	return email.querySelectorAll('.yW span[email]');
};

const isReminder = function (email, myEmailAddress) {
	// if user doesn't want reminders treated special, then just return as though current email is not a reminder
	if (options.reminderTreatment === 'none') return false;

	const nameNodes = getEmailParticipants(email);
	let allNamesMe = true;

	if (nameNodes.length === 0) allNamesMe = false;

	for (const nameNode of nameNodes) {
		if (nameNode.getAttribute('email') !== myEmailAddress) allNamesMe = false;
	}

	if (options.reminderTreatment === 'all') {
		return allNamesMe;
	} else if (options.reminderTreatment === 'containing-word') {
		const titleNode = email.querySelector('.y6');
		return allNamesMe && titleNode && titleNode.innerText.match(/reminder/i);
	}

	return false;
};

const isCalendarEvent = function (email) {
	const node = email.querySelector('.aKS .aJ6');
	return node && node.innerText === 'RSVP';
};

const addDateLabel = function (email, label) {
	if (email.previousSibling && email.previousSibling.className === 'time-row') {
		if (email.previousSibling.innerText === label) return;
		email.previousSibling.remove();
	}

	const timeRow = document.createElement('div');
	timeRow.classList.add('time-row');
	const time = document.createElement('div');
	time.className = 'time';
	time.innerText = label;
	timeRow.appendChild(time);

	email.parentElement.insertBefore(timeRow, email);
};

const getRawDate = function (email) {
	const dateElement = email.querySelector('.xW.xY span');
	if (dateElement) return dateElement.getAttribute('title');
};

const getDate = function (rawDate) {
	if (rawDate) return new Date(rawDate);
};

const buildDateLabel = function (date) {
	let now = new Date();
	if (date === undefined) return;

	if (now.getFullYear() == date.getFullYear()) {
		if (now.getMonth() == date.getMonth()) {
			if (now.getDate() == date.getDate()) return DATE_LABELS.TODAY;
			if (now.getDate() - 1 == date.getDate()) return DATE_LABELS.YESTERDAY;
			return DATE_LABELS.THIS_MONTH;
		}
		return months[date.getMonth()];
	}
	if (now.getFullYear() - 1 == date.getFullYear()) return DATE_LABELS.LAST_YEAR;

	return date.getFullYear().toString();
};

const cleanupDateLabels = function () {
	document.querySelectorAll('.time-row').forEach(row => {
		// Delete any back to back date labels
		if (row.nextSibling && row.nextSibling.className === 'time-row') row.remove();
		// Check nextSibling recursively until reaching the next .time-row
		// If all siblings are .bundled-email, then hide row
		else if (isEmptyDateLabel(row)) row.hidden = true;
	});
};

const isEmptyDateLabel = function (row) {
	const sibling = row.nextSibling;
	if (!sibling) return true;
	else if (sibling.className === 'time-row') return true;
	else if (![...sibling.classList].includes('bundled-email')) return false;
	return isEmptyDateLabel(sibling);
}

const getBundledLabels = function () {
	return Array.from(document.querySelectorAll('.BltHke[role=main] .bundle-wrapper')).reduce((bundledLabels, el) => {
		bundledLabels[el.attributes.bundleLabel.value] = true;
		return bundledLabels;
	}, {});
};

const addEventAttachment = function (email) {
	if (email.querySelector('.' + CALENDAR_ATTACHMENT_CLASS)) return;

	let title = 'Calendar Event';
	let time = '';
	const titleNode = email.querySelector('.bqe, .bog');
	if (titleNode) {
		const titleFullText = titleNode.innerText;
		let matches = Array.from(titleFullText.matchAll(/[^:]*: ([^@]*)@(.*)/g))[0];
		if (matches) {
			title = matches[1].trim();
			time = matches[2].trim();
		}
	}

	// build calendar attachment, this is based on regular attachments we no longer
	// have access to inbox to see the full structure
	const span = document.createElement('span');
	span.appendChild(document.createTextNode('Attachment'));
	span.classList.add('bzB');

	const attachmentNameSpan = document.createElement('span');
	attachmentNameSpan.classList.add('event-title');
	attachmentNameSpan.appendChild(document.createTextNode(title));

	const attachmentTimeSpan = document.createElement('span');
	attachmentTimeSpan.classList.add('event-time');
	attachmentTimeSpan.appendChild(document.createTextNode(time));

	const attachmentContentWrapper = document.createElement('span');
	attachmentContentWrapper.classList.add('brg');
	attachmentContentWrapper.appendChild(attachmentNameSpan);
	attachmentContentWrapper.appendChild(attachmentTimeSpan);

	// Find Invitation Action
	const action = email.querySelector('.aKS');
	if (action) attachmentContentWrapper.appendChild(action);

	const imageSpan = document.createElement('span');
	imageSpan.classList.add('calendar-image');

	const attachmentCard = document.createElement('div');
	attachmentCard.classList.add('brc');
	attachmentCard.setAttribute('role', 'listitem');
	attachmentCard.setAttribute('title', title);
	attachmentCard.appendChild(imageSpan);
	attachmentCard.appendChild(attachmentContentWrapper);

	const attachmentNode = document.createElement('div');
	attachmentNode.classList.add('brd', CALENDAR_ATTACHMENT_CLASS);
	attachmentNode.appendChild(span);
	attachmentNode.appendChild(attachmentCard);

	const emailSubjectWrapper = email.querySelectorAll('.a4W');
	if (emailSubjectWrapper) emailSubjectWrapper[0].appendChild(attachmentNode);
};

const reloadOptions = () => {
	chrome.runtime.sendMessage({ method: 'getOptions' }, function (ops) {
		options = ops;
	});

	// Add option classes to body for css styling, removes avatars when disabled
	if (options.showAvatar === 'enabled' && !document.body.classList.contains(AVATAR_OPTION_CLASS)) {
		document.body.classList.add(AVATAR_OPTION_CLASS);
	} else if (options.showAvatar === 'disabled' && document.body.classList.contains(AVATAR_OPTION_CLASS)) {
		document.body.classList.remove(AVATAR_OPTION_CLASS);
		document.querySelectorAll('.' + AVATAR_EMAIL_CLASS).forEach(avatarEl => avatarEl.classList.remove(AVATAR_EMAIL_CLASS));
		// Remove avatar elements
		document.querySelectorAll('.' + AVATAR_CLASS).forEach(avatarEl => avatarEl.remove());
	}
	
	// Add option classes to body for css styling, and unbundle emails when disabled
	if (options.emailBundling === 'enabled' && !document.body.classList.contains(BUNDLING_OPTION_CLASS)) {
		document.body.classList.add(BUNDLING_OPTION_CLASS);
	} else if (options.emailBundling === 'disabled' && document.body.classList.contains(BUNDLING_OPTION_CLASS)) {
		document.body.classList.remove(BUNDLING_OPTION_CLASS);
		// Unbundle emails
		document.querySelectorAll('.' + BUNDLED_EMAIL_CLASS).forEach(emailEl => emailEl.classList.remove(BUNDLED_EMAIL_CLASS));
		// Remove bundle wrapper rows
		document.querySelectorAll('.' + BUNDLE_WRAPPER_CLASS).forEach(bundleEl => bundleEl.remove());
	}
};

const getLabels = function (email) {
	return Array.from(email.querySelectorAll('.ar .at')).map(el => el.attributes.title.value);
};

const htmlToElements = function (html) {
	var template = document.createElement('template');
	template.innerHTML = html;
	return template.content.firstElementChild;
};

const addClassToEmail = (emailEl, klass) => emailEl.classList.add(klass);

const addClassToBundle = (label, klass) => {
	const bundle = document.querySelector(`div[bundleLabel="${label}"]`);
	if (bundle && !(bundle.classList.contains(klass))) bundle.classList.add(klass);
};

const removeClassFromBundle = (label, klass) => {
	const bundle = document.querySelector(`div[bundleLabel="${label}"]`);
	if (bundle && (bundle.classList.contains(klass))) bundle.classList.remove(klass);
};

const addCountToBundle = (label, count) => {
	const bundleLabel = document.querySelector(`div[bundleLabel="${label}"] .label-link`);
	if (!bundleLabel) return;
	const replacementHTML = `<span>${label}</span><span class="bundle-count">(${count})</span>`;
	if (bundleLabel.innerHTML !== replacementHTML) bundleLabel.innerHTML = replacementHTML;
};

const addSendersToBundle = (label, senders) => {
	const bundleSenders = document.querySelector(`div[bundleLabel="${label}"] .bundle-senders`);
	if (!bundleSenders) return;
	let uniqueSenders = senders.reverse().filter((sender, index, self) => self.findIndex(s => s.name === sender.name && s.isUnread === sender.isUnread) === index);
	const replacementHTML = `${uniqueSenders.map(sender => `<span class="${sender.isUnread ? 'strong' : ''}">${sender.name}</span>`).join(', ')}`
	if (bundleSenders.innerHTML !== replacementHTML) bundleSenders.innerHTML = replacementHTML;
};

const buildBundleWrapper = function (email, label, hasImportantMarkers) {
	const importantMarkerClass = hasImportantMarkers ? '' : 'hide-important-markers';

	const bundleWrapper = htmlToElements(`
			<div class="zA yO" bundleLabel="${label}">
				<span class="oZ-x3 xY aid bundle-image">
					<img src="${chrome.runtime.getURL('images/ic_custom-cluster_24px_g60_r3_2x.png')}"/>
				</span>
				<span class="WA xY ${importantMarkerClass}"></span>
				<span class="yX xY label-link .yW">${label}</span>
				<span class="xW xY">
					<span title="${getRawDate(email)}"/>
				</span>
				<div class="y2 bundle-senders"></div>
			</div>
	`);

	addClassToEmail(bundleWrapper, BUNDLE_WRAPPER_CLASS);

	bundleWrapper.onclick = () => {
		location.href = `#search/in%3Ainbox+label%3A${fixLabel(label)}`;
	};

	if (email && email.parentNode) email.parentElement.insertBefore(bundleWrapper, email);
};

const fixLabel = label => encodeURIComponent(label.replace(/[\/\\& ]/g, '-'));

const isInInbox = () => document.querySelector('.nZ a[title=Inbox]') !== null;

const isInBundle = () => document.location.hash.match(/#search\/in%3Ainbox\+label%3A/g) !== null;

const checkImportantMarkers = () => document.querySelector('td.WA.xY');

const checkEmailUnbundledLabel = labels => labels.filter(label => label.indexOf(UNBUNDLED_PARENT_LABEL) >= 0).length > 0;

const getReadStatus = (emailEl) => emailEl.className.indexOf('zE') < 0;

/**
 * If email has snooze data, return true.
 * Expects that the curDate should be larger than prevDate, if not, then
 * also return true;
 */
const isSnoozed = (email, curDate, prevDate) => {
	const node = email.querySelector('.by1.cL');
	if (node && node.innerText !== '') return true;

	return prevDate !== null && curDate < prevDate;
};

const isStarred = email => {
	const node = email.querySelector('.T-KT');
	if (node && node.title !== 'Not starred') return true;
};

/**
 * @return boolean true if email contains class
 */
const checkEmailClass = (emailEl, klass) => emailEl.classList.contains(klass);

const addClassToBody = (klass) => {
	if (!document.body.classList.contains(klass)) document.body.classList.add(klass);
};

const removeClassFromBody = (klass) => {
	if (document.body.classList.contains(klass)) document.body.classList.remove(klass);
};

const getEmails = () => {
	const emails = document.querySelectorAll('.BltHke[role=main] .zA');
	const myEmailAddress = getMyEmailAddress();
	const isInInboxFlag = isInInbox();
	const isInBundleFlag = isInBundle();
	const processedEmails = [];
	const allLabels = new Set();

	let prevTimeStamp = null;
	labelStats = {};

	isInBundleFlag ? addClassToBody(BUNDLE_PAGE_CLASS) : removeClassFromBody(BUNDLE_PAGE_CLASS);

	// Start from last email on page and head towards first
	for (let i = emails.length - 1; i >= 0; i--) {
		let email = emails[i];
		let info = {};
		info.emailEl = email;
		info.isReminder = isReminder(email, myEmailAddress);
		info.reminderAlreadyProcessed = () => checkEmailClass(email, REMINDER_EMAIL_CLASS);
		info.dateString = getRawDate(email);
		info.date = getDate(info.dateString);
		info.dateLabel = buildDateLabel(info.date);
		info.isSnooze = isSnoozed(email, info.date, prevTimeStamp);
		info.isStarred = isStarred(email);
		// Only update prevTimeStamp if not snoozed, because we might have multiple snoozes back to back
		if (!info.isSnooze && info.date) prevTimeStamp = info.date;
		info.isCalendarEvent = isCalendarEvent(email);
		info.labels = getLabels(email);
		info.labels.forEach(l => allLabels.add(l));

		info.unbundledAlreadyProcessed = () => checkEmailClass(email, UNBUNDLED_EMAIL_CLASS);
		// Check for Unbundled parent label, mark row as unbundled
		info.isUnbundled = checkEmailUnbundledLabel(info.labels);
		if ((isInInboxFlag || isInBundleFlag) && info.isUnbundled && !info.unbundledAlreadyProcessed()) {
			addClassToEmail(email, UNBUNDLED_EMAIL_CLASS);
			info.emailEl.querySelectorAll('.ar.as').forEach(labelEl => {
				if (labelEl.querySelector('.at').title.indexOf(UNBUNDLED_PARENT_LABEL) >= 0) {
					// Remove 'Unbundled/' from display in the UI
					labelEl.querySelector('.av').innerText = labelEl.innerText.replace(UNBUNDLED_PARENT_LABEL + '/', '');
				} else {
					// Hide labels that aren't nested under UNBUNDLED_PARENT_LABEL
					labelEl.hidden = true;
				}
			});
		}

		info.isUnread = !getReadStatus(email);

		// Collect senders, message count and unread stats for each label
		if (info.labels.length) {
			const participants = Array.from(getEmailParticipants(email));
			const firstParticipant = participants[0].getAttribute('name');
			info.labels.forEach(label => {
				if (!(label in labelStats)) {
					labelStats[label] = {
						title: label,
						count: 1,
						senders: [{
							name: firstParticipant,
							isUnread: info.isUnread
						}]
					};
				} else { 
					labelStats[label].count++;
					labelStats[label].senders.push({
						name: firstParticipant,
						isUnread: info.isUnread
					});
				}
				if (info.isUnread) labelStats[label].containsUnread = true;
			});
		}

		info.subjectEl = email.querySelector('.y6');
		info.subject = info.subjectEl && info.subjectEl.innerText.trim();

		info.isBundleEmail = () => checkEmailClass(email, BUNDLED_EMAIL_CLASS);
		info.isBundleWrapper = () => checkEmailClass(email, BUNDLE_WRAPPER_CLASS);
		info.avatarAlreadyProcessed = () => checkEmailClass(email, AVATAR_EMAIL_CLASS);
		info.bundleAlreadyProcessed = () => checkEmailClass(email, BUNDLED_EMAIL_CLASS) || checkEmailClass(email, BUNDLE_WRAPPER_CLASS);
		info.calendarAlreadyProcessed = () => checkEmailClass(email, CALENDAR_EMAIL_CLASS);

		processedEmails[i] = info;
	}

	// Update bundle stats
	for (label in labelStats) {
		// Set message count for each bundle row
		addCountToBundle(label, labelStats[label].count);
		// Set list of senders for each bundle row
		addSendersToBundle(label, labelStats[label].senders);
		// Set bold title class for any bundle containing an unread email
		labelStats[label].containsUnread ? addClassToBundle(label, UNREAD_BUNDLE_CLASS) : removeClassFromBundle(label, UNREAD_BUNDLE_CLASS);
	}

	return [processedEmails, allLabels];
};

const updateReminders = () => {
	reloadOptions();
	const [emails, allLabels] = getEmails();
	const myEmail = getMyEmailAddress();
	let lastLabel = null;
	let isInInboxFlag = isInInbox();
	let hasImportantMarkers = checkImportantMarkers();

	cleanupDateLabels();
	const emailBundles = getBundledLabels();

	for (const emailInfo of emails) {
		const emailEl = emailInfo.emailEl;

		if (emailInfo.isReminder && !emailInfo.reminderAlreadyProcessed()) { // skip if already added class
			if (emailInfo.subject.toLowerCase() === 'reminder') {
				emailInfo.subjectEl.outerHTML = '';
				emailEl.querySelectorAll('.Zt').forEach(node => node.outerHTML = '');
				emailEl.querySelectorAll('.y2').forEach(node => node.style.color = '#202124');
			}
			emailEl.querySelectorAll('.yP,.zF').forEach(node => { node.innerHTML = 'Reminder';});

			const avatarWrapperEl = emailEl.querySelector('.oZ-x3');
			if (avatarWrapperEl && avatarWrapperEl.getElementsByClassName(AVATAR_CLASS).length === 0) {
				const avatarElement = document.createElement('div');
				avatarElement.className = AVATAR_CLASS;
				avatarWrapperEl.appendChild(avatarElement);
			}
			addClassToEmail(emailEl, REMINDER_EMAIL_CLASS);
		} else if (options.showAvatar === 'enabled' && !emailInfo.reminderAlreadyProcessed() && !emailInfo.avatarAlreadyProcessed() && !emailInfo.bundleAlreadyProcessed()) {
			let participants = Array.from(getEmailParticipants(emailEl));	// convert to array to filter
			if (!participants.length) continue; // Prevents Drafts in Search or Drafts folder from causing errors
			let firstParticipant = participants[0];

			const excludingMe = participants.filter(node => node.getAttribute('email') !== myEmail && node.getAttribute('name'));
			// If there are others in the participants, use one of their initials instead
			if (excludingMe.length > 0) firstParticipant = excludingMe[0];

			const name = firstParticipant.getAttribute('name');
			const firstLetter = (name && name.toUpperCase()[0]) || '-';
			const targetElement = emailEl.querySelector('.oZ-x3');

			if (targetElement && targetElement.getElementsByClassName(AVATAR_CLASS).length === 0) {
				const avatarElement = document.createElement('div');
				avatarElement.className = AVATAR_CLASS;
				const firstLetterCode = firstLetter.charCodeAt(0);

				if (firstLetterCode >= 65 && firstLetterCode <= 90) {
					avatarElement.style.background = '#' + nameColors[firstLetterCode - 65];
				} else {
					avatarElement.style.background = '#000000';
					// Some unicode characters are not affected by 'color: white', hence this alternative
					avatarElement.style.color = 'transparent';
					avatarElement.style.textShadow = '0 0 0 #ffffff';
				}

				avatarElement.innerText = firstLetter;
				targetElement.appendChild(avatarElement);
			}

			addClassToEmail(emailEl, AVATAR_EMAIL_CLASS);
		}

		if (emailInfo.isCalendarEvent && !emailInfo.calendarAlreadyProcessed()) {
			addClassToEmail(emailEl, CALENDAR_EMAIL_CLASS);
			addEventAttachment(emailEl);
		}

		let label = emailInfo.dateLabel;
		// This is a hack for snoozed emails. If the snoozed email is the
		// first email, we just assume it arrived 'Today', any other snoozed email
		// joins whichever label the previous email had.
		if (emailInfo.isSnooze) label = (lastLabel == null) ? DATE_LABELS.TODAY : lastLabel;

		// Add date label if it's a new label
		if (label !== lastLabel) {
			addDateLabel(emailEl, label);
			lastLabel = label;
		}

		if (options.emailBundling === 'enabled') {
			// Remove bundles that no longer have associated emails
			if (emailInfo.isBundleWrapper() && !allLabels.has(emailEl.getAttribute('bundleLabel'))) {
				emailEl.remove();
				continue;
			}

			const labels = emailInfo.labels;
			if (isInInboxFlag && !emailInfo.isStarred && labels.length && !emailInfo.isUnbundled && !emailInfo.bundleAlreadyProcessed()) {
				labels.forEach(label => {
					addClassToEmail(emailEl, BUNDLED_EMAIL_CLASS);
					if (!(label in emailBundles)) {
						buildBundleWrapper(emailEl, label, hasImportantMarkers);
						emailBundles[label] = true;
					}
				});
			}
		}
	}
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
      if (node) _nodes[label] = node;
    });

    // others
    [
      { label: 'title',          selector: 'a[title=Gmail]:not([aria-label])' },
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
      if (node) _nodes[label] = node;
    });
  });
  observer.observe(document.body, { subtree: true, childList: true });
};

const reorderMenuItems = () => {
  const observer = new MutationObserver(() => {
    const parent = document.querySelector('.wT .byl');
    const refer = document.querySelector('.wT .byl>.TK');
    const { inbox, snoozed, done, drafts, sent, spam, trash, starred, important, chats } = _nodes;

    if (parent && refer && loadedMenu && inbox && snoozed && done && drafts && sent && spam && trash && starred && important && chats) {
      // Gmail will execute its script to add element to the first child, so
      // add one placeholder for it and do the rest in the next child.
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

      setupClickEventForNodes([inbox, snoozed, done, drafts, sent, spam, trash, starred, important, chats]);

      // Close More menu
      document.body.querySelector('.J-Ke.n4.ah9').click();
      observer.disconnect();
    }

    if (!loadedMenu && inbox) {
      // Open More menu
      document.body.querySelector('.J-Ke.n4.ah9').click();
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

const queryParentSelector = (elm, sel) => {
  if (!elm) return null;
  var parent = elm.parentElement;
  while (!parent.matches(sel)) {
    parent = parent.parentElement;
    if (!parent) return null;
  }
  return parent;
};

/*
**
**END OF LEFT MENU
**
*/

const triggerMouseEvent = function (node, event) {
	const mouseUpEvent = document.createEvent('MouseEvents');
	mouseUpEvent.initEvent(event, true, true);
	node.dispatchEvent(mouseUpEvent);
};

const waitForElement = function (selector, callback, tries = 100) {
	const element = document.querySelector(selector);
	if (element) callback(element);
	else if (tries > 0) setTimeout(() => waitForElement(selector, callback, tries - 1), 100);
};

document.addEventListener('DOMContentLoaded', function () {
	const addReminder = document.createElement('div');
	addReminder.className = 'add-reminder';
	addReminder.addEventListener('click', function () {
		const myEmail = getMyEmailAddress();

		// TODO: Replace all of the below with gmail.compose.start_compose() via the Gmail.js lib
		const composeButton = document.querySelector('.T-I.J-J5-Ji.T-I-KE.L3');
		triggerMouseEvent(composeButton, 'mousedown');
		triggerMouseEvent(composeButton, 'mouseup');

		// TODO: Delete waitForElement() function, replace with gmail.observe.on('compose') via the Gmail.js lib
		waitForElement('textarea[name=to]', to => {
			const title = document.querySelector('input[name=subjectbox]');
			const body = document.querySelector('div[aria-label="Message Body"]');

			to.value = myEmail;
			title.value = 'Reminder';
			body.focus();
		});
	});
	document.body.appendChild(addReminder);

	setInterval(updateReminders, 250);
});

const setFavicon = () => document.querySelector('link[rel*="shortcut icon"]').href = chrome.runtime.getURL('images/favicon.png');;

const init = () => {
	setFavicon();
	setupNodes();
	reorderMenuItems();
};

if (document.head) init();
else document.addEventListener('DOMContentLoaded', init);
