/**
 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
 *
 * @version 0.6.9
 * @codingstandard ftlabs-jsv2
 * @copyright The Financial Times Limited [All Rights Reserved]
 * @license MIT License (see LICENSE.txt)
 */

/*jslint browser:true, node:true*/
/*global define, Event, Node*/


/**
 * Instantiate fast-clicking listeners on the specificed layer.
 *
 * @constructor
 * @param {Element} layer The layer to listen on
 */
function FastClick(layer) {
	'use strict';
	var oldOnClick, self = this;


	/**
	 * Whether a click is currently being tracked.
	 *
	 * @type boolean
	 */
	this.trackingClick = false;


	/**
	 * Timestamp for when when click tracking started.
	 *
	 * @type number
	 */
	this.trackingClickStart = 0;


	/**
	 * The element being tracked for a click.
	 *
	 * @type EventTarget
	 */
	this.targetElement = null;


	/**
	 * X-coordinate of touch start event.
	 *
	 * @type number
	 */
	this.touchStartX = 0;


	/**
	 * Y-coordinate of touch start event.
	 *
	 * @type number
	 */
	this.touchStartY = 0;


	/**
	 * ID of the last touch, retrieved from Touch.identifier.
	 *
	 * @type number
	 */
	this.lastTouchIdentifier = 0;


	/**
	 * Touchmove boundary, beyond which a click will be cancelled.
	 *
	 * @type number
	 */
	this.touchBoundary = 10;


	/**
	 * The FastClick layer.
	 *
	 * @type Element
	 */
	this.layer = layer;

	if (!layer || !layer.nodeType) {
		throw new TypeError('Layer must be a document node');
	}

	/** @type function() */
	this.onClick = function() { return FastClick.prototype.onClick.apply(self, arguments); };

	/** @type function() */
	this.onMouse = function() { return FastClick.prototype.onMouse.apply(self, arguments); };

	/** @type function() */
	this.onTouchStart = function() { return FastClick.prototype.onTouchStart.apply(self, arguments); };

	/** @type function() */
	this.onTouchMove = function() { return FastClick.prototype.onTouchMove.apply(self, arguments); };

	/** @type function() */
	this.onTouchEnd = function() { return FastClick.prototype.onTouchEnd.apply(self, arguments); };

	/** @type function() */
	this.onTouchCancel = function() { return FastClick.prototype.onTouchCancel.apply(self, arguments); };

	if (FastClick.notNeeded(layer)) {
		return;
	}

	// Set up event handlers as required
	if (this.deviceIsAndroid) {
		layer.addEventListener('mouseover', this.onMouse, true);
		layer.addEventListener('mousedown', this.onMouse, true);
		layer.addEventListener('mouseup', this.onMouse, true);
	}

	layer.addEventListener('click', this.onClick, true);
	layer.addEventListener('touchstart', this.onTouchStart, false);
	layer.addEventListener('touchmove', this.onTouchMove, false);
	layer.addEventListener('touchend', this.onTouchEnd, false);
	layer.addEventListener('touchcancel', this.onTouchCancel, false);

	// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
	// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
	// layer when they are cancelled.
	if (!Event.prototype.stopImmediatePropagation) {
		layer.removeEventListener = function(type, callback, capture) {
			var rmv = Node.prototype.removeEventListener;
			if (type === 'click') {
				rmv.call(layer, type, callback.hijacked || callback, capture);
			} else {
				rmv.call(layer, type, callback, capture);
			}
		};

		layer.addEventListener = function(type, callback, capture) {
			var adv = Node.prototype.addEventListener;
			if (type === 'click') {
				adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
					if (!event.propagationStopped) {
						callback(event);
					}
				}), capture);
			} else {
				adv.call(layer, type, callback, capture);
			}
		};
	}

	// If a handler is already declared in the element's onclick attribute, it will be fired before
	// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
	// adding it as listener.
	if (typeof layer.onclick === 'function') {

		// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
		// - the old one won't work if passed to addEventListener directly.
		oldOnClick = layer.onclick;
		layer.addEventListener('click', function(event) {
			oldOnClick(event);
		}, false);
		layer.onclick = null;
	}
}


/**
 * Android requires exceptions.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0;


/**
 * iOS requires exceptions.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent);


/**
 * iOS 4 requires an exception for select elements.
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOS4 = FastClick.prototype.deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


/**
 * iOS 6.0(+?) requires the target element to be manually derived
 *
 * @type boolean
 */
FastClick.prototype.deviceIsIOSWithBadTarget = FastClick.prototype.deviceIsIOS && (/OS ([6-9]|\d{2})_\d/).test(navigator.userAgent);


/**
 * Determine whether a given element requires a native click.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element needs a native click
 */
FastClick.prototype.needsClick = function(target) {
	'use strict';
	switch (target.nodeName.toLowerCase()) {

	// Don't send a synthetic click to disabled inputs (issue #62)
	case 'button':
	case 'select':
	case 'textarea':
		if (target.disabled) {
			return true;
		}

		break;
	case 'input':

		// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
		if ((this.deviceIsIOS && target.type === 'file') || target.disabled) {
			return true;
		}

		break;
	case 'label':
	case 'video':
		return true;
	}

	return (/\bneedsclick\b/).test(target.className);
};


/**
 * Determine whether a given element requires a call to focus to simulate click into element.
 *
 * @param {EventTarget|Element} target Target DOM element
 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
 */
FastClick.prototype.needsFocus = function(target) {
	'use strict';
	switch (target.nodeName.toLowerCase()) {
	case 'textarea':
	case 'select':
		return true;
	case 'input':
		switch (target.type) {
		case 'button':
		case 'checkbox':
		case 'file':
		case 'image':
		case 'radio':
		case 'submit':
			return false;
		}

		// No point in attempting to focus disabled inputs
		return !target.disabled && !target.readOnly;
	default:
		return (/\bneedsfocus\b/).test(target.className);
	}
};


/**
 * Send a click event to the specified element.
 *
 * @param {EventTarget|Element} targetElement
 * @param {Event} event
 */
FastClick.prototype.sendClick = function(targetElement, event) {
	'use strict';
	var clickEvent, touch;

	// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
	if (document.activeElement && document.activeElement !== targetElement) {
		document.activeElement.blur();
	}

	touch = event.changedTouches[0];

	// Synthesise a click event, with an extra attribute so it can be tracked
	clickEvent = document.createEvent('MouseEvents');
	clickEvent.initMouseEvent('click', true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
	clickEvent.forwardedTouchEvent = true;
	targetElement.dispatchEvent(clickEvent);
};


/**
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.focus = function(targetElement) {
	'use strict';
	var length;

	if (this.deviceIsIOS && targetElement.setSelectionRange) {
		length = targetElement.value.length;
		targetElement.setSelectionRange(length, length);
	} else {
		targetElement.focus();
	}
};


/**
 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
 *
 * @param {EventTarget|Element} targetElement
 */
FastClick.prototype.updateScrollParent = function(targetElement) {
	'use strict';
	var scrollParent, parentElement;

	scrollParent = targetElement.fastClickScrollParent;

	// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
	// target element was moved to another parent.
	if (!scrollParent || !scrollParent.contains(targetElement)) {
		parentElement = targetElement;
		do {
			if (parentElement.scrollHeight > parentElement.offsetHeight) {
				scrollParent = parentElement;
				targetElement.fastClickScrollParent = parentElement;
				break;
			}

			parentElement = parentElement.parentElement;
		} while (parentElement);
	}

	// Always update the scroll top tracker if possible.
	if (scrollParent) {
		scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
	}
};


/**
 * @param {EventTarget} targetElement
 * @returns {Element|EventTarget}
 */
FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {
	'use strict';

	// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
	if (eventTarget.nodeType === Node.TEXT_NODE) {
		return eventTarget.parentNode;
	}

	return eventTarget;
};


/**
 * On touch start, record the position and scroll offset.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchStart = function(event) {
	'use strict';
	var targetElement, touch, selection;

	// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
	if (event.targetTouches.length > 1) {
		return true;
	}

	targetElement = this.getTargetElementFromEventTarget(event.target);
	touch = event.targetTouches[0];

	if (this.deviceIsIOS) {

		// Only trusted events will deselect text on iOS (issue #49)
		selection = window.getSelection();
		if (selection.rangeCount && !selection.isCollapsed) {
			return true;
		}

		if (!this.deviceIsIOS4) {

			// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
			// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
			// with the same identifier as the touch event that previously triggered the click that triggered the alert.
			// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
			// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
			if (touch.identifier === this.lastTouchIdentifier) {
				event.preventDefault();
				return false;
			}

			this.lastTouchIdentifier = touch.identifier;

			// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
			// 1) the user does a fling scroll on the scrollable layer
			// 2) the user stops the fling scroll with another tap
			// then the event.target of the last 'touchend' event will be the element that was under the user's finger
			// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
			// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
			this.updateScrollParent(targetElement);
		}
	}

	this.trackingClick = true;
	this.trackingClickStart = event.timeStamp;
	this.targetElement = targetElement;

	this.touchStartX = touch.pageX;
	this.touchStartY = touch.pageY;

	// Prevent phantom clicks on fast double-tap (issue #36)
	if ((event.timeStamp - this.lastClickTime) < 200) {
		event.preventDefault();
	}

	return true;
};


/**
 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.touchHasMoved = function(event) {
	'use strict';
	var touch = event.changedTouches[0], boundary = this.touchBoundary;

	if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
		return true;
	}

	return false;
};


/**
 * Update the last position.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchMove = function(event) {
	'use strict';
	if (!this.trackingClick) {
		return true;
	}

	// If the touch has moved, cancel the click tracking
	if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
		this.trackingClick = false;
		this.targetElement = null;
	}

	return true;
};


/**
 * Attempt to find the labelled control for the given label element.
 *
 * @param {EventTarget|HTMLLabelElement} labelElement
 * @returns {Element|null}
 */
FastClick.prototype.findControl = function(labelElement) {
	'use strict';

	// Fast path for newer browsers supporting the HTML5 control attribute
	if (labelElement.control !== undefined) {
		return labelElement.control;
	}

	// All browsers under test that support touch events also support the HTML5 htmlFor attribute
	if (labelElement.htmlFor) {
		return document.getElementById(labelElement.htmlFor);
	}

	// If no for attribute exists, attempt to retrieve the first labellable descendant element
	// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
	return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
};


/**
 * On touch end, determine whether to send a click event at once.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onTouchEnd = function(event) {
	'use strict';
	var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

	if (!this.trackingClick) {
		return true;
	}

	// Prevent phantom clicks on fast double-tap (issue #36)
	if ((event.timeStamp - this.lastClickTime) < 200) {
		this.cancelNextClick = true;
		return true;
	}

	this.lastClickTime = event.timeStamp;

	trackingClickStart = this.trackingClickStart;
	this.trackingClick = false;
	this.trackingClickStart = 0;

	// On some iOS devices, the targetElement supplied with the event is invalid if the layer
	// is performing a transition or scroll, and has to be re-detected manually. Note that
	// for this to function correctly, it must be called *after* the event target is checked!
	// See issue #57; also filed as rdar://13048589 .
	if (this.deviceIsIOSWithBadTarget) {
		touch = event.changedTouches[0];

		// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
		targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
		targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
	}

	targetTagName = targetElement.tagName.toLowerCase();
	if (targetTagName === 'label') {
		forElement = this.findControl(targetElement);
		if (forElement) {
			this.focus(targetElement);
			if (this.deviceIsAndroid) {
				return false;
			}

			targetElement = forElement;
		}
	} else if (this.needsFocus(targetElement)) {

		// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
		// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
		if ((event.timeStamp - trackingClickStart) > 100 || (this.deviceIsIOS && window.top !== window && targetTagName === 'input')) {
			this.targetElement = null;
			return false;
		}

		this.focus(targetElement);

		// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
		if (!this.deviceIsIOS4 || targetTagName !== 'select') {
			this.targetElement = null;
			event.preventDefault();
		}

		return false;
	}

	if (this.deviceIsIOS && !this.deviceIsIOS4) {

		// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
		// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
		scrollParent = targetElement.fastClickScrollParent;
		if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
			return true;
		}
	}

	// Prevent the actual click from going though - unless the target node is marked as requiring
	// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
	if (!this.needsClick(targetElement)) {
		event.preventDefault();
		this.sendClick(targetElement, event);
	}

	return false;
};


/**
 * On touch cancel, stop tracking the click.
 *
 * @returns {void}
 */
FastClick.prototype.onTouchCancel = function() {
	'use strict';
	this.trackingClick = false;
	this.targetElement = null;
};


/**
 * Determine mouse events which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onMouse = function(event) {
	'use strict';

	// If a target element was never set (because a touch event was never fired) allow the event
	if (!this.targetElement) {
		return true;
	}

	if (event.forwardedTouchEvent) {
		return true;
	}

	// Programmatically generated events targeting a specific element should be permitted
	if (!event.cancelable) {
		return true;
	}

	// Derive and check the target element to see whether the mouse event needs to be permitted;
	// unless explicitly enabled, prevent non-touch click events from triggering actions,
	// to prevent ghost/doubleclicks.
	if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

		// Prevent any user-added listeners declared on FastClick element from being fired.
		if (event.stopImmediatePropagation) {
			event.stopImmediatePropagation();
		} else {

			// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
			event.propagationStopped = true;
		}

		// Cancel the event
		event.stopPropagation();
		event.preventDefault();

		return false;
	}

	// If the mouse event is permitted, return true for the action to go through.
	return true;
};


/**
 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
 * an actual click which should be permitted.
 *
 * @param {Event} event
 * @returns {boolean}
 */
FastClick.prototype.onClick = function(event) {
	'use strict';
	var permitted;

	// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
	if (this.trackingClick) {
		this.targetElement = null;
		this.trackingClick = false;
		return true;
	}

	// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
	if (event.target.type === 'submit' && event.detail === 0) {
		return true;
	}

	permitted = this.onMouse(event);

	// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
	if (!permitted) {
		this.targetElement = null;
	}

	// If clicks are permitted, return true for the action to go through.
	return permitted;
};


/**
 * Remove all FastClick's event listeners.
 *
 * @returns {void}
 */
FastClick.prototype.destroy = function() {
	'use strict';
	var layer = this.layer;

	if (this.deviceIsAndroid) {
		layer.removeEventListener('mouseover', this.onMouse, true);
		layer.removeEventListener('mousedown', this.onMouse, true);
		layer.removeEventListener('mouseup', this.onMouse, true);
	}

	layer.removeEventListener('click', this.onClick, true);
	layer.removeEventListener('touchstart', this.onTouchStart, false);
	layer.removeEventListener('touchmove', this.onTouchMove, false);
	layer.removeEventListener('touchend', this.onTouchEnd, false);
	layer.removeEventListener('touchcancel', this.onTouchCancel, false);
};


/**
 * Check whether FastClick is needed.
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.notNeeded = function(layer) {
	'use strict';
	var metaViewport;

	// Devices that don't support touch don't need FastClick
	if (typeof window.ontouchstart === 'undefined') {
		return true;
	}

	if ((/Chrome\/[0-9]+/).test(navigator.userAgent)) {

		// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
		if (FastClick.prototype.deviceIsAndroid) {
			metaViewport = document.querySelector('meta[name=viewport]');
			if (metaViewport && metaViewport.content.indexOf('user-scalable=no') !== -1) {
				return true;
			}

		// Chrome desktop doesn't need FastClick (issue #15)
		} else {
			return true;
		}
	}

	// IE10 with -ms-touch-action: none, which disables double-tap-to-zoom (issue #97)
	if (layer.style.msTouchAction === 'none') {
		return true;
	}

	return false;
};


/**
 * Factory method for creating a FastClick object
 *
 * @param {Element} layer The layer to listen on
 */
FastClick.attach = function(layer) {
	'use strict';
	return new FastClick(layer);
};


if (typeof define !== 'undefined' && define.amd) {

	// AMD. Register as an anonymous module.
	define(function() {
		'use strict';
		return FastClick;
	});
} else if (typeof module !== 'undefined' && module.exports) {
	module.exports = FastClick.attach;
	module.exports.FastClick = FastClick;
} else {
	window.FastClick = FastClick;
}

/* Hammer.JS - v1.0.5 - 2013-04-07
 * http://eightmedia.github.com/hammer.js
 *
 * Copyright (c) 2013 Jorik Tangelder <j.tangelder@gmail.com>;
 * Licensed under the MIT license */

(function(window, undefined) {
    'use strict';

/**
 * Hammer
 * use this to create instances
 * @param   {HTMLElement}   element
 * @param   {Object}        options
 * @returns {Hammer.Instance}
 * @constructor
 */
var Hammer = function(element, options) {
    return new Hammer.Instance(element, options || {});
};

// default settings
Hammer.defaults = {
    // add styles and attributes to the element to prevent the browser from doing
    // its native behavior. this doesnt prevent the scrolling, but cancels
    // the contextmenu, tap highlighting etc
    // set to false to disable this
    stop_browser_behavior: {
		// this also triggers onselectstart=false for IE
        userSelect: 'none',
		// this makes the element blocking in IE10 >, you could experiment with the value
		// see for more options this issue; https://github.com/EightMedia/hammer.js/issues/241
        touchAction: 'none',
		touchCallout: 'none',
        contentZooming: 'none',
        userDrag: 'none',
        tapHighlightColor: 'rgba(0,0,0,0)'
    }

    // more settings are defined per gesture at gestures.js
};

// detect touchevents
Hammer.HAS_POINTEREVENTS = navigator.pointerEnabled || navigator.msPointerEnabled;
Hammer.HAS_TOUCHEVENTS = ('ontouchstart' in window);

// dont use mouseevents on mobile devices
Hammer.MOBILE_REGEX = /mobile|tablet|ip(ad|hone|od)|android/i;
Hammer.NO_MOUSEEVENTS = Hammer.HAS_TOUCHEVENTS && navigator.userAgent.match(Hammer.MOBILE_REGEX);

// eventtypes per touchevent (start, move, end)
// are filled by Hammer.event.determineEventTypes on setup
Hammer.EVENT_TYPES = {};

// direction defines
Hammer.DIRECTION_DOWN = 'down';
Hammer.DIRECTION_LEFT = 'left';
Hammer.DIRECTION_UP = 'up';
Hammer.DIRECTION_RIGHT = 'right';

// pointer type
Hammer.POINTER_MOUSE = 'mouse';
Hammer.POINTER_TOUCH = 'touch';
Hammer.POINTER_PEN = 'pen';

// touch event defines
Hammer.EVENT_START = 'start';
Hammer.EVENT_MOVE = 'move';
Hammer.EVENT_END = 'end';

// hammer document where the base events are added at
Hammer.DOCUMENT = document;

// plugins namespace
Hammer.plugins = {};

// if the window events are set...
Hammer.READY = false;

/**
 * setup events to detect gestures on the document
 */
function setup() {
    if(Hammer.READY) {
        return;
    }

    // find what eventtypes we add listeners to
    Hammer.event.determineEventTypes();

    // Register all gestures inside Hammer.gestures
    for(var name in Hammer.gestures) {
        if(Hammer.gestures.hasOwnProperty(name)) {
            Hammer.detection.register(Hammer.gestures[name]);
        }
    }

    // Add touch events on the document
    Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_MOVE, Hammer.detection.detect);
    Hammer.event.onTouch(Hammer.DOCUMENT, Hammer.EVENT_END, Hammer.detection.detect);

    // Hammer is ready...!
    Hammer.READY = true;
}

/**
 * create new hammer instance
 * all methods should return the instance itself, so it is chainable.
 * @param   {HTMLElement}       element
 * @param   {Object}            [options={}]
 * @returns {Hammer.Instance}
 * @constructor
 */
Hammer.Instance = function(element, options) {
    var self = this;

    // setup HammerJS window events and register all gestures
    // this also sets up the default options
    setup();

    this.element = element;

    // start/stop detection option
    this.enabled = true;

    // merge options
    this.options = Hammer.utils.extend(
        Hammer.utils.extend({}, Hammer.defaults),
        options || {});

    // add some css to the element to prevent the browser from doing its native behavoir
    if(this.options.stop_browser_behavior) {
        Hammer.utils.stopDefaultBrowserBehavior(this.element, this.options.stop_browser_behavior);
    }

    // start detection on touchstart
    Hammer.event.onTouch(element, Hammer.EVENT_START, function(ev) {
        if(self.enabled) {
            Hammer.detection.startDetect(self, ev);
        }
    });

    // return instance
    return this;
};


Hammer.Instance.prototype = {
    /**
     * bind events to the instance
     * @param   {String}      gesture
     * @param   {Function}    handler
     * @returns {Hammer.Instance}
     */
    on: function onEvent(gesture, handler){
        var gestures = gesture.split(' ');
        for(var t=0; t<gestures.length; t++) {
            this.element.addEventListener(gestures[t], handler, false);
        }
        return this;
    },


    /**
     * unbind events to the instance
     * @param   {String}      gesture
     * @param   {Function}    handler
     * @returns {Hammer.Instance}
     */
    off: function offEvent(gesture, handler){
        var gestures = gesture.split(' ');
        for(var t=0; t<gestures.length; t++) {
            this.element.removeEventListener(gestures[t], handler, false);
        }
        return this;
    },


    /**
     * trigger gesture event
     * @param   {String}      gesture
     * @param   {Object}      eventData
     * @returns {Hammer.Instance}
     */
    trigger: function triggerEvent(gesture, eventData){
        // create DOM event
        var event = Hammer.DOCUMENT.createEvent('Event');
		event.initEvent(gesture, true, true);
		event.gesture = eventData;

        // trigger on the target if it is in the instance element,
        // this is for event delegation tricks
        var element = this.element;
        if(Hammer.utils.hasParent(eventData.target, element)) {
            element = eventData.target;
        }

        element.dispatchEvent(event);
        return this;
    },


    /**
     * enable of disable hammer.js detection
     * @param   {Boolean}   state
     * @returns {Hammer.Instance}
     */
    enable: function enable(state) {
        this.enabled = state;
        return this;
    }
};

/**
 * this holds the last move event,
 * used to fix empty touchend issue
 * see the onTouch event for an explanation
 * @type {Object}
 */
var last_move_event = null;


/**
 * when the mouse is hold down, this is true
 * @type {Boolean}
 */
var enable_detect = false;


/**
 * when touch events have been fired, this is true
 * @type {Boolean}
 */
var touch_triggered = false;


Hammer.event = {
    /**
     * simple addEventListener
     * @param   {HTMLElement}   element
     * @param   {String}        type
     * @param   {Function}      handler
     */
    bindDom: function(element, type, handler) {
        var types = type.split(' ');
        for(var t=0; t<types.length; t++) {
            element.addEventListener(types[t], handler, false);
        }
    },


    /**
     * touch events with mouse fallback
     * @param   {HTMLElement}   element
     * @param   {String}        eventType        like Hammer.EVENT_MOVE
     * @param   {Function}      handler
     */
    onTouch: function onTouch(element, eventType, handler) {
		var self = this;

        this.bindDom(element, Hammer.EVENT_TYPES[eventType], function bindDomOnTouch(ev) {
            var sourceEventType = ev.type.toLowerCase();

            // onmouseup, but when touchend has been fired we do nothing.
            // this is for touchdevices which also fire a mouseup on touchend
            if(sourceEventType.match(/mouse/) && touch_triggered) {
                return;
            }

            // mousebutton must be down or a touch event
            else if( sourceEventType.match(/touch/) ||   // touch events are always on screen
                sourceEventType.match(/pointerdown/) || // pointerevents touch
                (sourceEventType.match(/mouse/) && ev.which === 1)   // mouse is pressed
            ){
                enable_detect = true;
            }

            // we are in a touch event, set the touch triggered bool to true,
            // this for the conflicts that may occur on ios and android
            if(sourceEventType.match(/touch|pointer/)) {
                touch_triggered = true;
            }

            // count the total touches on the screen
            var count_touches = 0;

            // when touch has been triggered in this detection session
            // and we are now handling a mouse event, we stop that to prevent conflicts
            if(enable_detect) {
                // update pointerevent
                if(Hammer.HAS_POINTEREVENTS && eventType != Hammer.EVENT_END) {
                    count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                }
                // touch
                else if(sourceEventType.match(/touch/)) {
                    count_touches = ev.touches.length;
                }
                // mouse
                else if(!touch_triggered) {
                    count_touches = sourceEventType.match(/up/) ? 0 : 1;
                }

                // if we are in a end event, but when we remove one touch and
                // we still have enough, set eventType to move
                if(count_touches > 0 && eventType == Hammer.EVENT_END) {
                    eventType = Hammer.EVENT_MOVE;
                }
                // no touches, force the end event
                else if(!count_touches) {
                    eventType = Hammer.EVENT_END;
                }

                // because touchend has no touches, and we often want to use these in our gestures,
                // we send the last move event as our eventData in touchend
                if(!count_touches && last_move_event !== null) {
                    ev = last_move_event;
                }
                // store the last move event
                else {
                    last_move_event = ev;
                }

                // trigger the handler
                handler.call(Hammer.detection, self.collectEventData(element, eventType, ev));

                // remove pointerevent from list
                if(Hammer.HAS_POINTEREVENTS && eventType == Hammer.EVENT_END) {
                    count_touches = Hammer.PointerEvent.updatePointer(eventType, ev);
                }
            }

            //debug(sourceEventType +" "+ eventType);

            // on the end we reset everything
            if(!count_touches) {
                last_move_event = null;
                enable_detect = false;
                touch_triggered = false;
                Hammer.PointerEvent.reset();
            }
        });
    },


    /**
     * we have different events for each device/browser
     * determine what we need and set them in the Hammer.EVENT_TYPES constant
     */
    determineEventTypes: function determineEventTypes() {
        // determine the eventtype we want to set
        var types;

        // pointerEvents magic
        if(Hammer.HAS_POINTEREVENTS) {
            types = Hammer.PointerEvent.getEvents();
        }
        // on Android, iOS, blackberry, windows mobile we dont want any mouseevents
        else if(Hammer.NO_MOUSEEVENTS) {
            types = [
                'touchstart',
                'touchmove',
                'touchend touchcancel'];
        }
        // for non pointer events browsers and mixed browsers,
        // like chrome on windows8 touch laptop
        else {
            types = [
                'touchstart mousedown',
                'touchmove mousemove',
                'touchend touchcancel mouseup'];
        }

        Hammer.EVENT_TYPES[Hammer.EVENT_START]  = types[0];
        Hammer.EVENT_TYPES[Hammer.EVENT_MOVE]   = types[1];
        Hammer.EVENT_TYPES[Hammer.EVENT_END]    = types[2];
    },


    /**
     * create touchlist depending on the event
     * @param   {Object}    ev
     * @param   {String}    eventType   used by the fakemultitouch plugin
     */
    getTouchList: function getTouchList(ev/*, eventType*/) {
        // get the fake pointerEvent touchlist
        if(Hammer.HAS_POINTEREVENTS) {
            return Hammer.PointerEvent.getTouchList();
        }
        // get the touchlist
        else if(ev.touches) {
            return ev.touches;
        }
        // make fake touchlist from mouse position
        else {
            return [{
                identifier: 1,
                pageX: ev.pageX,
                pageY: ev.pageY,
                target: ev.target
            }];
        }
    },


    /**
     * collect event data for Hammer js
     * @param   {HTMLElement}   element
     * @param   {String}        eventType        like Hammer.EVENT_MOVE
     * @param   {Object}        eventData
     */
    collectEventData: function collectEventData(element, eventType, ev) {
        var touches = this.getTouchList(ev, eventType);

        // find out pointerType
        var pointerType = Hammer.POINTER_TOUCH;
        if(ev.type.match(/mouse/) || Hammer.PointerEvent.matchType(Hammer.POINTER_MOUSE, ev)) {
            pointerType = Hammer.POINTER_MOUSE;
        }

        return {
            center      : Hammer.utils.getCenter(touches),
            timeStamp   : new Date().getTime(),
            target      : ev.target,
            touches     : touches,
            eventType   : eventType,
            pointerType : pointerType,
            srcEvent    : ev,

            /**
             * prevent the browser default actions
             * mostly used to disable scrolling of the browser
             */
            preventDefault: function() {
                if(this.srcEvent.preventManipulation) {
                    this.srcEvent.preventManipulation();
                }

                if(this.srcEvent.preventDefault) {
                    this.srcEvent.preventDefault();
                }
            },

            /**
             * stop bubbling the event up to its parents
             */
            stopPropagation: function() {
                this.srcEvent.stopPropagation();
            },

            /**
             * immediately stop gesture detection
             * might be useful after a swipe was detected
             * @return {*}
             */
            stopDetect: function() {
                return Hammer.detection.stopDetect();
            }
        };
    }
};

Hammer.PointerEvent = {
    /**
     * holds all pointers
     * @type {Object}
     */
    pointers: {},

    /**
     * get a list of pointers
     * @returns {Array}     touchlist
     */
    getTouchList: function() {
        var self = this;
        var touchlist = [];

        // we can use forEach since pointerEvents only is in IE10
        Object.keys(self.pointers).sort().forEach(function(id) {
            touchlist.push(self.pointers[id]);
        });
        return touchlist;
    },

    /**
     * update the position of a pointer
     * @param   {String}   type             Hammer.EVENT_END
     * @param   {Object}   pointerEvent
     */
    updatePointer: function(type, pointerEvent) {
        if(type == Hammer.EVENT_END) {
            this.pointers = {};
        }
        else {
            pointerEvent.identifier = pointerEvent.pointerId;
            this.pointers[pointerEvent.pointerId] = pointerEvent;
        }

        return Object.keys(this.pointers).length;
    },

    /**
     * check if ev matches pointertype
     * @param   {String}        pointerType     Hammer.POINTER_MOUSE
     * @param   {PointerEvent}  ev
     */
    matchType: function(pointerType, ev) {
        if(!ev.pointerType) {
            return false;
        }

        var types = {};
        types[Hammer.POINTER_MOUSE] = (ev.pointerType == ev.MSPOINTER_TYPE_MOUSE || ev.pointerType == Hammer.POINTER_MOUSE);
        types[Hammer.POINTER_TOUCH] = (ev.pointerType == ev.MSPOINTER_TYPE_TOUCH || ev.pointerType == Hammer.POINTER_TOUCH);
        types[Hammer.POINTER_PEN] = (ev.pointerType == ev.MSPOINTER_TYPE_PEN || ev.pointerType == Hammer.POINTER_PEN);
        return types[pointerType];
    },


    /**
     * get events
     */
    getEvents: function() {
        return [
            'pointerdown MSPointerDown',
            'pointermove MSPointerMove',
            'pointerup pointercancel MSPointerUp MSPointerCancel'
        ];
    },

    /**
     * reset the list
     */
    reset: function() {
        this.pointers = {};
    }
};


Hammer.utils = {
    /**
     * extend method,
     * also used for cloning when dest is an empty object
     * @param   {Object}    dest
     * @param   {Object}    src
	 * @parm	{Boolean}	merge		do a merge
     * @returns {Object}    dest
     */
    extend: function extend(dest, src, merge) {
        for (var key in src) {
			if(dest[key] !== undefined && merge) {
				continue;
			}
            dest[key] = src[key];
        }
        return dest;
    },


    /**
     * find if a node is in the given parent
     * used for event delegation tricks
     * @param   {HTMLElement}   node
     * @param   {HTMLElement}   parent
     * @returns {boolean}       has_parent
     */
    hasParent: function(node, parent) {
        while(node){
            if(node == parent) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    },


    /**
     * get the center of all the touches
     * @param   {Array}     touches
     * @returns {Object}    center
     */
    getCenter: function getCenter(touches) {
        var valuesX = [], valuesY = [];

        for(var t= 0,len=touches.length; t<len; t++) {
            valuesX.push(touches[t].pageX);
            valuesY.push(touches[t].pageY);
        }

        return {
            pageX: ((Math.min.apply(Math, valuesX) + Math.max.apply(Math, valuesX)) / 2),
            pageY: ((Math.min.apply(Math, valuesY) + Math.max.apply(Math, valuesY)) / 2)
        };
    },


    /**
     * calculate the velocity between two points
     * @param   {Number}    delta_time
     * @param   {Number}    delta_x
     * @param   {Number}    delta_y
     * @returns {Object}    velocity
     */
    getVelocity: function getVelocity(delta_time, delta_x, delta_y) {
        return {
            x: Math.abs(delta_x / delta_time) || 0,
            y: Math.abs(delta_y / delta_time) || 0
        };
    },


    /**
     * calculate the angle between two coordinates
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {Number}    angle
     */
    getAngle: function getAngle(touch1, touch2) {
        var y = touch2.pageY - touch1.pageY,
            x = touch2.pageX - touch1.pageX;
        return Math.atan2(y, x) * 180 / Math.PI;
    },


    /**
     * angle to direction define
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {String}    direction constant, like Hammer.DIRECTION_LEFT
     */
    getDirection: function getDirection(touch1, touch2) {
        var x = Math.abs(touch1.pageX - touch2.pageX),
            y = Math.abs(touch1.pageY - touch2.pageY);

        if(x >= y) {
            return touch1.pageX - touch2.pageX > 0 ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
        }
        else {
            return touch1.pageY - touch2.pageY > 0 ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
        }
    },


    /**
     * calculate the distance between two touches
     * @param   {Touch}     touch1
     * @param   {Touch}     touch2
     * @returns {Number}    distance
     */
    getDistance: function getDistance(touch1, touch2) {
        var x = touch2.pageX - touch1.pageX,
            y = touch2.pageY - touch1.pageY;
        return Math.sqrt((x*x) + (y*y));
    },


    /**
     * calculate the scale factor between two touchLists (fingers)
     * no scale is 1, and goes down to 0 when pinched together, and bigger when pinched out
     * @param   {Array}     start
     * @param   {Array}     end
     * @returns {Number}    scale
     */
    getScale: function getScale(start, end) {
        // need two fingers...
        if(start.length >= 2 && end.length >= 2) {
            return this.getDistance(end[0], end[1]) /
                this.getDistance(start[0], start[1]);
        }
        return 1;
    },


    /**
     * calculate the rotation degrees between two touchLists (fingers)
     * @param   {Array}     start
     * @param   {Array}     end
     * @returns {Number}    rotation
     */
    getRotation: function getRotation(start, end) {
        // need two fingers
        if(start.length >= 2 && end.length >= 2) {
            return this.getAngle(end[1], end[0]) -
                this.getAngle(start[1], start[0]);
        }
        return 0;
    },


    /**
     * boolean if the direction is vertical
     * @param    {String}    direction
     * @returns  {Boolean}   is_vertical
     */
    isVertical: function isVertical(direction) {
        return (direction == Hammer.DIRECTION_UP || direction == Hammer.DIRECTION_DOWN);
    },


    /**
     * stop browser default behavior with css props
     * @param   {HtmlElement}   element
     * @param   {Object}        css_props
     */
    stopDefaultBrowserBehavior: function stopDefaultBrowserBehavior(element, css_props) {
        var prop,
            vendors = ['webkit','khtml','moz','ms','o',''];

        if(!css_props || !element.style) {
            return;
        }

        // with css properties for modern browsers
        for(var i = 0; i < vendors.length; i++) {
            for(var p in css_props) {
                if(css_props.hasOwnProperty(p)) {
                    prop = p;

                    // vender prefix at the property
                    if(vendors[i]) {
                        prop = vendors[i] + prop.substring(0, 1).toUpperCase() + prop.substring(1);
                    }

                    // set the style
                    element.style[prop] = css_props[p];
                }
            }
        }

        // also the disable onselectstart
        if(css_props.userSelect == 'none') {
            element.onselectstart = function() {
                return false;
            };
        }
    }
};

Hammer.detection = {
    // contains all registred Hammer.gestures in the correct order
    gestures: [],

    // data of the current Hammer.gesture detection session
    current: null,

    // the previous Hammer.gesture session data
    // is a full clone of the previous gesture.current object
    previous: null,

    // when this becomes true, no gestures are fired
    stopped: false,


    /**
     * start Hammer.gesture detection
     * @param   {Hammer.Instance}   inst
     * @param   {Object}            eventData
     */
    startDetect: function startDetect(inst, eventData) {
        // already busy with a Hammer.gesture detection on an element
        if(this.current) {
            return;
        }

        this.stopped = false;

        this.current = {
            inst        : inst, // reference to HammerInstance we're working for
            startEvent  : Hammer.utils.extend({}, eventData), // start eventData for distances, timing etc
            lastEvent   : false, // last eventData
            name        : '' // current gesture we're in/detected, can be 'tap', 'hold' etc
        };

        this.detect(eventData);
    },


    /**
     * Hammer.gesture detection
     * @param   {Object}    eventData
     * @param   {Object}    eventData
     */
    detect: function detect(eventData) {
        if(!this.current || this.stopped) {
            return;
        }

        // extend event data with calculations about scale, distance etc
        eventData = this.extendEventData(eventData);

        // instance options
        var inst_options = this.current.inst.options;

        // call Hammer.gesture handlers
        for(var g=0,len=this.gestures.length; g<len; g++) {
            var gesture = this.gestures[g];

            // only when the instance options have enabled this gesture
            if(!this.stopped && inst_options[gesture.name] !== false) {
                // if a handler returns false, we stop with the detection
                if(gesture.handler.call(gesture, eventData, this.current.inst) === false) {
                    this.stopDetect();
                    break;
                }
            }
        }

        // store as previous event event
        if(this.current) {
            this.current.lastEvent = eventData;
        }

        // endevent, but not the last touch, so dont stop
        if(eventData.eventType == Hammer.EVENT_END && !eventData.touches.length-1) {
            this.stopDetect();
        }

        return eventData;
    },


    /**
     * clear the Hammer.gesture vars
     * this is called on endDetect, but can also be used when a final Hammer.gesture has been detected
     * to stop other Hammer.gestures from being fired
     */
    stopDetect: function stopDetect() {
        // clone current data to the store as the previous gesture
        // used for the double tap gesture, since this is an other gesture detect session
        this.previous = Hammer.utils.extend({}, this.current);

        // reset the current
        this.current = null;

        // stopped!
        this.stopped = true;
    },


    /**
     * extend eventData for Hammer.gestures
     * @param   {Object}   ev
     * @returns {Object}   ev
     */
    extendEventData: function extendEventData(ev) {
        var startEv = this.current.startEvent;

        // if the touches change, set the new touches over the startEvent touches
        // this because touchevents don't have all the touches on touchstart, or the
        // user must place his fingers at the EXACT same time on the screen, which is not realistic
        // but, sometimes it happens that both fingers are touching at the EXACT same time
        if(startEv && (ev.touches.length != startEv.touches.length || ev.touches === startEv.touches)) {
            // extend 1 level deep to get the touchlist with the touch objects
            startEv.touches = [];
            for(var i=0,len=ev.touches.length; i<len; i++) {
                startEv.touches.push(Hammer.utils.extend({}, ev.touches[i]));
            }
        }

        var delta_time = ev.timeStamp - startEv.timeStamp,
            delta_x = ev.center.pageX - startEv.center.pageX,
            delta_y = ev.center.pageY - startEv.center.pageY,
            velocity = Hammer.utils.getVelocity(delta_time, delta_x, delta_y);

        Hammer.utils.extend(ev, {
            deltaTime   : delta_time,

            deltaX      : delta_x,
            deltaY      : delta_y,

            velocityX   : velocity.x,
            velocityY   : velocity.y,

            distance    : Hammer.utils.getDistance(startEv.center, ev.center),
            angle       : Hammer.utils.getAngle(startEv.center, ev.center),
            direction   : Hammer.utils.getDirection(startEv.center, ev.center),

            scale       : Hammer.utils.getScale(startEv.touches, ev.touches),
            rotation    : Hammer.utils.getRotation(startEv.touches, ev.touches),

            startEvent  : startEv
        });

        return ev;
    },


    /**
     * register new gesture
     * @param   {Object}    gesture object, see gestures.js for documentation
     * @returns {Array}     gestures
     */
    register: function register(gesture) {
        // add an enable gesture options if there is no given
        var options = gesture.defaults || {};
        if(options[gesture.name] === undefined) {
            options[gesture.name] = true;
        }

        // extend Hammer default options with the Hammer.gesture options
        Hammer.utils.extend(Hammer.defaults, options, true);

        // set its index
        gesture.index = gesture.index || 1000;

        // add Hammer.gesture to the list
        this.gestures.push(gesture);

        // sort the list by index
        this.gestures.sort(function(a, b) {
            if (a.index < b.index) {
                return -1;
            }
            if (a.index > b.index) {
                return 1;
            }
            return 0;
        });

        return this.gestures;
    }
};


Hammer.gestures = Hammer.gestures || {};

/**
 * Custom gestures
 * ==============================
 *
 * Gesture object
 * --------------------
 * The object structure of a gesture:
 *
 * { name: 'mygesture',
 *   index: 1337,
 *   defaults: {
 *     mygesture_option: true
 *   }
 *   handler: function(type, ev, inst) {
 *     // trigger gesture event
 *     inst.trigger(this.name, ev);
 *   }
 * }

 * @param   {String}    name
 * this should be the name of the gesture, lowercase
 * it is also being used to disable/enable the gesture per instance config.
 *
 * @param   {Number}    [index=1000]
 * the index of the gesture, where it is going to be in the stack of gestures detection
 * like when you build an gesture that depends on the drag gesture, it is a good
 * idea to place it after the index of the drag gesture.
 *
 * @param   {Object}    [defaults={}]
 * the default settings of the gesture. these are added to the instance settings,
 * and can be overruled per instance. you can also add the name of the gesture,
 * but this is also added by default (and set to true).
 *
 * @param   {Function}  handler
 * this handles the gesture detection of your custom gesture and receives the
 * following arguments:
 *
 *      @param  {Object}    eventData
 *      event data containing the following properties:
 *          timeStamp   {Number}        time the event occurred
 *          target      {HTMLElement}   target element
 *          touches     {Array}         touches (fingers, pointers, mouse) on the screen
 *          pointerType {String}        kind of pointer that was used. matches Hammer.POINTER_MOUSE|TOUCH
 *          center      {Object}        center position of the touches. contains pageX and pageY
 *          deltaTime   {Number}        the total time of the touches in the screen
 *          deltaX      {Number}        the delta on x axis we haved moved
 *          deltaY      {Number}        the delta on y axis we haved moved
 *          velocityX   {Number}        the velocity on the x
 *          velocityY   {Number}        the velocity on y
 *          angle       {Number}        the angle we are moving
 *          direction   {String}        the direction we are moving. matches Hammer.DIRECTION_UP|DOWN|LEFT|RIGHT
 *          distance    {Number}        the distance we haved moved
 *          scale       {Number}        scaling of the touches, needs 2 touches
 *          rotation    {Number}        rotation of the touches, needs 2 touches *
 *          eventType   {String}        matches Hammer.EVENT_START|MOVE|END
 *          srcEvent    {Object}        the source event, like TouchStart or MouseDown *
 *          startEvent  {Object}        contains the same properties as above,
 *                                      but from the first touch. this is used to calculate
 *                                      distances, deltaTime, scaling etc
 *
 *      @param  {Hammer.Instance}    inst
 *      the instance we are doing the detection for. you can get the options from
 *      the inst.options object and trigger the gesture event by calling inst.trigger
 *
 *
 * Handle gestures
 * --------------------
 * inside the handler you can get/set Hammer.detection.current. This is the current
 * detection session. It has the following properties
 *      @param  {String}    name
 *      contains the name of the gesture we have detected. it has not a real function,
 *      only to check in other gestures if something is detected.
 *      like in the drag gesture we set it to 'drag' and in the swipe gesture we can
 *      check if the current gesture is 'drag' by accessing Hammer.detection.current.name
 *
 *      @readonly
 *      @param  {Hammer.Instance}    inst
 *      the instance we do the detection for
 *
 *      @readonly
 *      @param  {Object}    startEvent
 *      contains the properties of the first gesture detection in this session.
 *      Used for calculations about timing, distance, etc.
 *
 *      @readonly
 *      @param  {Object}    lastEvent
 *      contains all the properties of the last gesture detect in this session.
 *
 * after the gesture detection session has been completed (user has released the screen)
 * the Hammer.detection.current object is copied into Hammer.detection.previous,
 * this is usefull for gestures like doubletap, where you need to know if the
 * previous gesture was a tap
 *
 * options that have been set by the instance can be received by calling inst.options
 *
 * You can trigger a gesture event by calling inst.trigger("mygesture", event).
 * The first param is the name of your gesture, the second the event argument
 *
 *
 * Register gestures
 * --------------------
 * When an gesture is added to the Hammer.gestures object, it is auto registered
 * at the setup of the first Hammer instance. You can also call Hammer.detection.register
 * manually and pass your gesture object as a param
 *
 */

/**
 * Hold
 * Touch stays at the same place for x time
 * @events  hold
 */
Hammer.gestures.Hold = {
    name: 'hold',
    index: 10,
    defaults: {
        hold_timeout	: 500,
        hold_threshold	: 1
    },
    timer: null,
    handler: function holdGesture(ev, inst) {
        switch(ev.eventType) {
            case Hammer.EVENT_START:
                // clear any running timers
                clearTimeout(this.timer);

                // set the gesture so we can check in the timeout if it still is
                Hammer.detection.current.name = this.name;

                // set timer and if after the timeout it still is hold,
                // we trigger the hold event
                this.timer = setTimeout(function() {
                    if(Hammer.detection.current.name == 'hold') {
                        inst.trigger('hold', ev);
                    }
                }, inst.options.hold_timeout);
                break;

            // when you move or end we clear the timer
            case Hammer.EVENT_MOVE:
                if(ev.distance > inst.options.hold_threshold) {
                    clearTimeout(this.timer);
                }
                break;

            case Hammer.EVENT_END:
                clearTimeout(this.timer);
                break;
        }
    }
};


/**
 * Tap/DoubleTap
 * Quick touch at a place or double at the same place
 * @events  tap, doubletap
 */
Hammer.gestures.Tap = {
    name: 'tap',
    index: 100,
    defaults: {
        tap_max_touchtime	: 250,
        tap_max_distance	: 10,
		tap_always			: true,
        doubletap_distance	: 20,
        doubletap_interval	: 300
    },
    handler: function tapGesture(ev, inst) {
        if(ev.eventType == Hammer.EVENT_END) {
            // previous gesture, for the double tap since these are two different gesture detections
            var prev = Hammer.detection.previous,
				did_doubletap = false;

            // when the touchtime is higher then the max touch time
            // or when the moving distance is too much
            if(ev.deltaTime > inst.options.tap_max_touchtime ||
                ev.distance > inst.options.tap_max_distance) {
                return;
            }

            // check if double tap
            if(prev && prev.name == 'tap' &&
                (ev.timeStamp - prev.lastEvent.timeStamp) < inst.options.doubletap_interval &&
                ev.distance < inst.options.doubletap_distance) {
				inst.trigger('doubletap', ev);
				did_doubletap = true;
            }

			// do a single tap
			if(!did_doubletap || inst.options.tap_always) {
				Hammer.detection.current.name = 'tap';
				inst.trigger(Hammer.detection.current.name, ev);
			}
        }
    }
};


/**
 * Swipe
 * triggers swipe events when the end velocity is above the threshold
 * @events  swipe, swipeleft, swiperight, swipeup, swipedown
 */
Hammer.gestures.Swipe = {
    name: 'swipe',
    index: 40,
    defaults: {
        // set 0 for unlimited, but this can conflict with transform
        swipe_max_touches  : 1,
        swipe_velocity     : 0.7
    },
    handler: function swipeGesture(ev, inst) {
        if(ev.eventType == Hammer.EVENT_END) {
            // max touches
            if(inst.options.swipe_max_touches > 0 &&
                ev.touches.length > inst.options.swipe_max_touches) {
                return;
            }

            // when the distance we moved is too small we skip this gesture
            // or we can be already in dragging
            if(ev.velocityX > inst.options.swipe_velocity ||
                ev.velocityY > inst.options.swipe_velocity) {
                // trigger swipe events
                inst.trigger(this.name, ev);
                inst.trigger(this.name + ev.direction, ev);
            }
        }
    }
};


/**
 * Drag
 * Move with x fingers (default 1) around on the page. Blocking the scrolling when
 * moving left and right is a good practice. When all the drag events are blocking
 * you disable scrolling on that area.
 * @events  drag, drapleft, dragright, dragup, dragdown
 */
Hammer.gestures.Drag = {
    name: 'drag',
    index: 50,
    defaults: {
        drag_min_distance : 10,
        // set 0 for unlimited, but this can conflict with transform
        drag_max_touches  : 1,
        // prevent default browser behavior when dragging occurs
        // be careful with it, it makes the element a blocking element
        // when you are using the drag gesture, it is a good practice to set this true
        drag_block_horizontal   : false,
        drag_block_vertical     : false,
        // drag_lock_to_axis keeps the drag gesture on the axis that it started on,
        // It disallows vertical directions if the initial direction was horizontal, and vice versa.
        drag_lock_to_axis       : false,
        // drag lock only kicks in when distance > drag_lock_min_distance
        // This way, locking occurs only when the distance has become large enough to reliably determine the direction
        drag_lock_min_distance : 25
    },
    triggered: false,
    handler: function dragGesture(ev, inst) {
        // current gesture isnt drag, but dragged is true
        // this means an other gesture is busy. now call dragend
        if(Hammer.detection.current.name != this.name && this.triggered) {
            inst.trigger(this.name +'end', ev);
            this.triggered = false;
            return;
        }

        // max touches
        if(inst.options.drag_max_touches > 0 &&
            ev.touches.length > inst.options.drag_max_touches) {
            return;
        }

        switch(ev.eventType) {
            case Hammer.EVENT_START:
                this.triggered = false;
                break;

            case Hammer.EVENT_MOVE:
                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(ev.distance < inst.options.drag_min_distance &&
                    Hammer.detection.current.name != this.name) {
                    return;
                }

                // we are dragging!
                Hammer.detection.current.name = this.name;

                // lock drag to axis?
                if(Hammer.detection.current.lastEvent.drag_locked_to_axis || (inst.options.drag_lock_to_axis && inst.options.drag_lock_min_distance<=ev.distance)) {
                    ev.drag_locked_to_axis = true;
                }
                var last_direction = Hammer.detection.current.lastEvent.direction;
                if(ev.drag_locked_to_axis && last_direction !== ev.direction) {
                    // keep direction on the axis that the drag gesture started on
                    if(Hammer.utils.isVertical(last_direction)) {
                        ev.direction = (ev.deltaY < 0) ? Hammer.DIRECTION_UP : Hammer.DIRECTION_DOWN;
                    }
                    else {
                        ev.direction = (ev.deltaX < 0) ? Hammer.DIRECTION_LEFT : Hammer.DIRECTION_RIGHT;
                    }
                }

                // first time, trigger dragstart event
                if(!this.triggered) {
                    inst.trigger(this.name +'start', ev);
                    this.triggered = true;
                }

                // trigger normal event
                inst.trigger(this.name, ev);

                // direction event, like dragdown
                inst.trigger(this.name + ev.direction, ev);

                // block the browser events
                if( (inst.options.drag_block_vertical && Hammer.utils.isVertical(ev.direction)) ||
                    (inst.options.drag_block_horizontal && !Hammer.utils.isVertical(ev.direction))) {
                    ev.preventDefault();
                }
                break;

            case Hammer.EVENT_END:
                // trigger dragend
                if(this.triggered) {
                    inst.trigger(this.name +'end', ev);
                }

                this.triggered = false;
                break;
        }
    }
};


/**
 * Transform
 * User want to scale or rotate with 2 fingers
 * @events  transform, pinch, pinchin, pinchout, rotate
 */
Hammer.gestures.Transform = {
    name: 'transform',
    index: 45,
    defaults: {
        // factor, no scale is 1, zoomin is to 0 and zoomout until higher then 1
        transform_min_scale     : 0.01,
        // rotation in degrees
        transform_min_rotation  : 1,
        // prevent default browser behavior when two touches are on the screen
        // but it makes the element a blocking element
        // when you are using the transform gesture, it is a good practice to set this true
        transform_always_block  : false
    },
    triggered: false,
    handler: function transformGesture(ev, inst) {
        // current gesture isnt drag, but dragged is true
        // this means an other gesture is busy. now call dragend
        if(Hammer.detection.current.name != this.name && this.triggered) {
            inst.trigger(this.name +'end', ev);
            this.triggered = false;
            return;
        }

        // atleast multitouch
        if(ev.touches.length < 2) {
            return;
        }

        // prevent default when two fingers are on the screen
        if(inst.options.transform_always_block) {
            ev.preventDefault();
        }

        switch(ev.eventType) {
            case Hammer.EVENT_START:
                this.triggered = false;
                break;

            case Hammer.EVENT_MOVE:
                var scale_threshold = Math.abs(1-ev.scale);
                var rotation_threshold = Math.abs(ev.rotation);

                // when the distance we moved is too small we skip this gesture
                // or we can be already in dragging
                if(scale_threshold < inst.options.transform_min_scale &&
                    rotation_threshold < inst.options.transform_min_rotation) {
                    return;
                }

                // we are transforming!
                Hammer.detection.current.name = this.name;

                // first time, trigger dragstart event
                if(!this.triggered) {
                    inst.trigger(this.name +'start', ev);
                    this.triggered = true;
                }

                inst.trigger(this.name, ev); // basic transform event

                // trigger rotate event
                if(rotation_threshold > inst.options.transform_min_rotation) {
                    inst.trigger('rotate', ev);
                }

                // trigger pinch event
                if(scale_threshold > inst.options.transform_min_scale) {
                    inst.trigger('pinch', ev);
                    inst.trigger('pinch'+ ((ev.scale < 1) ? 'in' : 'out'), ev);
                }
                break;

            case Hammer.EVENT_END:
                // trigger dragend
                if(this.triggered) {
                    inst.trigger(this.name +'end', ev);
                }

                this.triggered = false;
                break;
        }
    }
};


/**
 * Touch
 * Called as first, tells the user has touched the screen
 * @events  touch
 */
Hammer.gestures.Touch = {
    name: 'touch',
    index: -Infinity,
    defaults: {
        // call preventDefault at touchstart, and makes the element blocking by
        // disabling the scrolling of the page, but it improves gestures like
        // transforming and dragging.
        // be careful with using this, it can be very annoying for users to be stuck
        // on the page
        prevent_default: false,

        // disable mouse events, so only touch (or pen!) input triggers events
        prevent_mouseevents: false
    },
    handler: function touchGesture(ev, inst) {
        if(inst.options.prevent_mouseevents && ev.pointerType == Hammer.POINTER_MOUSE) {
            ev.stopDetect();
            return;
        }

        if(inst.options.prevent_default) {
            ev.preventDefault();
        }

        if(ev.eventType ==  Hammer.EVENT_START) {
            inst.trigger(this.name, ev);
        }
    }
};


/**
 * Release
 * Called as last, tells the user has released the screen
 * @events  release
 */
Hammer.gestures.Release = {
    name: 'release',
    index: Infinity,
    handler: function releaseGesture(ev, inst) {
        if(ev.eventType ==  Hammer.EVENT_END) {
            inst.trigger(this.name, ev);
        }
    }
};

// node export
if(typeof module === 'object' && typeof module.exports === 'object'){
    module.exports = Hammer;
}
// just window export
else {
    window.Hammer = Hammer;

    // requireJS module definition
    if(typeof window.define === 'function' && window.define.amd) {
        window.define('hammer', [], function() {
            return Hammer;
        });
    }
}
})(this);

(function($, undefined) {
    'use strict';

    // no jQuery or Zepto!
    if($ === undefined) {
        return;
    }

    /**
     * bind dom events
     * this overwrites addEventListener
     * @param   {HTMLElement}   element
     * @param   {String}        eventTypes
     * @param   {Function}      handler
     */
    Hammer.event.bindDom = function(element, eventTypes, handler) {
        $(element).on(eventTypes, function(ev) {
            var data = ev.originalEvent || ev;

            // IE pageX fix
            if(data.pageX === undefined) {
                data.pageX = ev.pageX;
                data.pageY = ev.pageY;
            }

            // IE target fix
            if(!data.target) {
                data.target = ev.target;
            }

            // IE button fix
            if(data.which === undefined) {
                data.which = data.button;
            }

            // IE preventDefault
            if(!data.preventDefault) {
                data.preventDefault = ev.preventDefault;
            }

            // IE stopPropagation
            if(!data.stopPropagation) {
                data.stopPropagation = ev.stopPropagation;
            }

            handler.call(this, data);
        });
    };

    /**
     * the methods are called by the instance, but with the jquery plugin
     * we use the jquery event methods instead.
     * @this    {Hammer.Instance}
     * @return  {jQuery}
     */
    Hammer.Instance.prototype.on = function(types, handler) {
        return $(this.element).on(types, handler);
    };
    Hammer.Instance.prototype.off = function(types, handler) {
        return $(this.element).off(types, handler);
    };


    /**
     * trigger events
     * this is called by the gestures to trigger an event like 'tap'
     * @this    {Hammer.Instance}
     * @param   {String}    gesture
     * @param   {Object}    eventData
     * @return  {jQuery}
     */
    Hammer.Instance.prototype.trigger = function(gesture, eventData){
        var el = $(this.element);
        if(el.has(eventData.target).length) {
            el = $(eventData.target);
        }

        return el.trigger({
            type: gesture,
            gesture: eventData
        });
    };


    /**
     * jQuery plugin
     * create instance of Hammer and watch for gestures,
     * and when called again you can change the options
     * @param   {Object}    [options={}]
     * @return  {jQuery}
     */
    $.fn.hammer = function(options) {
        return this.each(function() {
            var el = $(this);
            var inst = el.data('hammer');
            // start new hammer instance
            if(!inst) {
                el.data('hammer', new Hammer(this, options || {}));
            }
            // change the options
            else if(inst && options) {
                Hammer.utils.extend(inst.options, options);
            }
        });
    };

})(window.jQuery || window.Zepto);
if (!jQuery.fn.find) {
  jQuery.fn.extend({
    find: function( selector ) {
      var i, ret, self,
      len = this.length;

      if ( typeof selector !== "string" ) {
        self = this;
        return this.pushStack( jQuery( selector ).filter(function() {
          for ( i = 0; i < len; i++ ) {
            if ( jQuery.contains( self[ i ], this ) ) {
              return true;
            }
          }
        }));
      }

      ret = [];
      for ( i = 0; i < len; i++ ) {
        jQuery.find( selector, this[ i ], ret );
      }
        
      // Needed because $( selector, context ) becomes $( context ).find( selector )
      ret = this.pushStack( len > 1 ? jQuery.unique( ret ) : ret );
      ret.selector = ( this.selector ? this.selector + " " : "" ) + selector;
      return ret;
    }
  });
}

if (!jQuery.fn.on) {
  jQuery.fn.extend({
    on: function( types, selector, data, fn, /*INTERNAL*/ one ) {
      var type, origFn;

      // Types can be a map of types/handlers
      if ( typeof types === "object" ) {
        // ( types-Object, selector, data )
        if ( typeof selector !== "string" ) {
          // ( types-Object, data )
          data = data || selector;
          selector = undefined;
        }
        for ( type in types ) {
          this.on( type, selector, data, types[ type ], one );
        }
        return this;
      }

      if ( data == null && fn == null ) {
        // ( types, fn )
        fn = selector;
        data = selector = undefined;
      } else if ( fn == null ) {
        if ( typeof selector === "string" ) {
          // ( types, selector, fn )
          fn = data;
          data = undefined;
        } else {
          // ( types, data, fn )
          fn = data;
          data = selector;
          selector = undefined;
        }
      }
      if ( fn === false ) {
        fn = returnFalse;
      } else if ( !fn ) {
        return this;
      }

      if ( one === 1 ) {
        origFn = fn;
        fn = function( event ) {
          // Can use an empty set, since event contains the info
          jQuery().off( event );
          return origFn.apply( this, arguments );
        };
        // Use same guid so caller can remove using origFn
        fn.guid = origFn.guid || ( origFn.guid = jQuery.guid++ );
      }
      return this.each( function() {
        jQuery.event.add( this, types, fn, data, selector );
      });
    }
  });
}

if (!jQuery.fn.one) {
  jQuery.fn.extend({
    one: function( types, selector, data, fn ) {
      return this.on( types, selector, data, fn, 1 );
    }
  });
}

if (!jQuery.fn.off) {
  jQuery.fn.extend({
    off: function( types, selector, fn ) {
      var handleObj, type;
      if ( types && types.preventDefault && types.handleObj ) {
        // ( event )  dispatched jQuery.Event
        handleObj = types.handleObj;
        jQuery( types.delegateTarget ).off(
          handleObj.namespace ? handleObj.origType + "." + handleObj.namespace : handleObj.origType,
          handleObj.selector,
          handleObj.handler
        );
        return this;
      }
      if ( typeof types === "object" ) {
        // ( types-object [, selector] )
        for ( type in types ) {
          this.off( type, selector, types[ type ] );
        }
        return this;
      }
      if ( selector === false || typeof selector === "function" ) {
        // ( types [, fn] )
        fn = selector;
        selector = undefined;
      }
      if ( fn === false ) {
        fn = returnFalse;
      }
      return this.each(function() {
        jQuery.event.remove( this, types, fn, selector );
      });
    }
  });
}
/*
 * jQuery imagesLoaded plugin v2.1.1
 * http://github.com/desandro/imagesloaded
 *
 * MIT License. by Paul Irish et al.
 */

/*jshint curly: true, eqeqeq: true, noempty: true, strict: true, undef: true, browser: true */
/*global jQuery: false */

;(function($, undefined) {
'use strict';

// blank image data-uri bypasses webkit log warning (thx doug jones)
var BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

$.fn.imagesLoaded = function( callback ) {
  var $this = this,
    deferred = $.isFunction($.Deferred) ? $.Deferred() : 0,
    hasNotify = $.isFunction(deferred.notify),
    $images = $this.find('img').add( $this.filter('img') ),
    loaded = [],
    proper = [],
    broken = [];

  // Register deferred callbacks
  if ($.isPlainObject(callback)) {
    $.each(callback, function (key, value) {
      if (key === 'callback') {
        callback = value;
      } else if (deferred) {
        deferred[key](value);
      }
    });
  }

  function doneLoading() {
    var $proper = $(proper),
      $broken = $(broken);

    if ( deferred ) {
      if ( broken.length ) {
        deferred.reject( $images, $proper, $broken );
      } else {
        deferred.resolve( $images );
      }
    }

    if ( $.isFunction( callback ) ) {
      callback.call( $this, $images, $proper, $broken );
    }
  }

  function imgLoadedHandler( event ) {
    imgLoaded( event.target, event.type === 'error' );
  }

  function imgLoaded( img, isBroken ) {
    // don't proceed if BLANK image, or image is already loaded
    if ( img.src === BLANK || $.inArray( img, loaded ) !== -1 ) {
      return;
    }

    // store element in loaded images array
    loaded.push( img );

    // keep track of broken and properly loaded images
    if ( isBroken ) {
      broken.push( img );
    } else {
      proper.push( img );
    }

    // cache image and its state for future calls
    $.data( img, 'imagesLoaded', { isBroken: isBroken, src: img.src } );

    // trigger deferred progress method if present
    if ( hasNotify ) {
      deferred.notifyWith( $(img), [ isBroken, $images, $(proper), $(broken) ] );
    }

    // call doneLoading and clean listeners if all images are loaded
    if ( $images.length === loaded.length ) {
      setTimeout( doneLoading );
      $images.unbind( '.imagesLoaded', imgLoadedHandler );
    }
  }

  // if no images, trigger immediately
  if ( !$images.length ) {
    doneLoading();
  } else {
    $images.bind( 'load.imagesLoaded error.imagesLoaded', imgLoadedHandler )
    .each( function( i, el ) {
      var src = el.src;

      // find out if this image has been already checked for status
      // if it was, and src has not changed, call imgLoaded on it
      var cached = $.data( el, 'imagesLoaded' );
      if ( cached && cached.src === src ) {
        imgLoaded( el, cached.isBroken );
        return;
      }

      // if complete is true and browser supports natural sizes, try
      // to check for image status manually
      if ( el.complete && el.naturalWidth !== undefined ) {
        imgLoaded( el, el.naturalWidth === 0 || el.naturalHeight === 0 );
        return;
      }

      // cached images don't fire load sometimes, so we reset src, but only when
      // dealing with IE, or image is complete (loaded) and failed manual check
      // webkit hack from http://groups.google.com/group/jquery-dev/browse_thread/thread/eee6ab7b2da50e1f
      if ( el.readyState || el.complete ) {
        el.src = BLANK;
        el.src = src;
      }
    });
  }

  return deferred ? deferred.promise( $this ) : $this;
};

})(jQuery);

if(typeof(soysauce) === "undefined") {
"use strict";

soysauce = {
  widgets: new Array(),
  vars: {
    idCount: 0,
    degradeAll: (/Android ([12]|4\.0)|Opera|SAMSUNG-SGH-I747|SCH-I535/.test(navigator.userAgent)) ? true : false,
    degrade: (/Android ([12]|4\.0)|Opera|SAMSUNG-SGH-I747/.test(navigator.userAgent)) ? true : false,
    degrade2: (/SCH-I535/.test(navigator.userAgent)) ? true : false,
    lastResizeTime: 0,
    lastResizeTimerID: 0,
    fastclick: []
  },
  getOptions: function(selector) {
    if(!$(selector).attr("data-ss-options")) return false;
    return $(selector).attr("data-ss-options").split(" ");
  },
  getPrefix: function() {
    if (navigator.userAgent.match(/webkit/i) !== null) return "-webkit-";
    else if (navigator.userAgent.match(/windows\sphone|msie/i) !== null) return "-ms-";
    else if (navigator.userAgent.match(/^mozilla/i) !== null) return "-moz-";
    else if (navigator.userAgent.match(/opera/i) !== null) return "-o-";
    return "";
  },
  stifle: function(e, onlyPropagation) {
    if (!e) return false;
    try {
      e.stopImmediatePropagation();
      if (e.gesture) {
        e.gesture.stopPropagation();
      }
    }
    catch(err) {
      console.log(e);
      console.warn("Soysauce: Error occurred calling soysauce.stifle() " + err.message);
      e.stopPropagation();
      e.propagationStopped = true;
    }
    if (onlyPropagation) return false;
    e.preventDefault();
    if (e.gesture) {
      e.gesture.preventDefault();
    }
  },
  fetch: function(selector) {
    var query, ret;
    
    if (!selector) return false;
    
    if (typeof(selector) === "object") {
      selector = parseInt($(selector).attr("data-ss-id"), 10);
    }
    
    if (typeof(selector) === "string") {
      var val = parseInt($(selector).attr("data-ss-id"), 10);;

      if (isNaN(val)) {
        val = parseInt(selector, 10);
      }

      selector = val;
    }
    
    if (selector===+selector && selector === (selector|0)) {
      query = "[data-ss-id='" + selector + "']";
    }
    else {
      query = selector;
    }

    soysauce.widgets.forEach(function(widget) {
      if (!widget) return;
      if (widget.id === selector) {
        ret = widget;
      }
    });

    if (!ret) {
      return false;
    }
    else {
      return ret;
    }
  },
  destroy: function(selector) {
    try {
      var widget = soysauce.fetch(selector);
      var $widget = widget.widget;
      
      $widget.off("*");
      $widget.hammer().off("*");
      $widget.empty();
      $widget.off();
      $widget.hammer().off();
      $widget.remove();
      
      delete soysauce.widgets[widget.id - 1];
      
      return true;
    }
    catch(e) {
      console.warn("Soysauce: could not destroy widget with id '" + widget.id + "'. Possible memory leaks. Message: " + e.message);
    }
    
    return false;
  },
  getCoords: function(e) {
    if (!e) return;
    if (e.originalEvent !== undefined) e = e.originalEvent;
    if (e.touches && e.touches.length === 1)
      return {x: e.touches[0].clientX, y: e.touches[0].clientY};
    else if (e.touches && e.touches.length === 2)
      return {x: e.touches[0].clientX, y: e.touches[0].clientY, x2: e.touches[1].clientX, y2: e.touches[1].clientY};
    else if (e.changedTouches && e.changedTouches.length === 1)
      return {x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY};
    else if (e.changedTouches && e.changedTouches.length === 2)
      return {x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY, x2: e.changedTouches[1].clientX, y2: e.changedTouches[1].clientY};
    else if (e.clientX !== undefined)
      return {x: e.clientX, y: e.clientY};
  },
  getArrayFromMatrix: function(matrix) {
    return matrix.substr(7, matrix.length - 8).split(', ');
  },
  browser: {
    pageLoad: new Date().getTime(),
    supportsSVG: (document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure", "1.1")) ? true : false,
    supportsLocalStorage: function() {
      try { 
        if (localStorage) {
          localStorage.setItem("test", 1);
          localStorage.removeItem("test");
          return true;
        }
        else { 
          return false; 
        }
      }
      catch(err) { 
        return false;
      }
    }(),
    supportsSessionStorage: function() {
      try { 
        if (sessionStorage) {
          sessionStorage.setItem("test", 1);
          sessionStorage.removeItem("test");
          return true;
        }
        else { 
          return false; 
        }
      }
      catch(err) { 
        return false;
      }
    }(),
    orientation: function() {
      return (window.orientation !== 0) ? "landscape" : "portrait";
    }(),
    ios7BarsVisible: function() {
      if (!/(ipod|iphone).*(7\.0 mobile)/i.test(navigator.userAgent)) return false;
      if (window.orientation !== 0) {
        return (window.innerHeight < 320);
      }
      else {
        return (window.innerHeight < 529);
      }
    }()
  },
  browserInfo: {
    supportsLocalStorage: function() {
      try { 
        if (localStorage) {
          localStorage.setItem("test", 1);
          localStorage.removeItem("test");
          return true;
        }
        else { 
          return false; 
        }
      }
      catch(err) { 
        return false;
      }
    }(),
    supportsSessionStorage: function() {
      try { 
        if (sessionStorage) {
          sessionStorage.setItem("test", 1);
          sessionStorage.removeItem("test");
          return true;
        }
        else { 
          return false; 
        }
      }
      catch(err) { 
        return false;
      }
    }()
  },
  scrollTop: function() {
    window.setTimeout(function(){
      window.scrollTo(0, 1);
    }, 0);
  }
}

// Widget Resize Handler
$(window).on("resize", function(e) {
  if (soysauce.vars.lastResizeID) clearTimeout(soysauce.vars.lastResizeID);
  soysauce.vars.lastResizeID = window.setTimeout(function() {
    soysauce.vars.lastResizeTime = e.timeStamp;
    soysauce.widgets.forEach(function(widget) {
      if (!widget.handleResize) return;
      widget.handleResize();
      if (/carousel/i.test(widget.type)) {
        if (widget.itemWidth) {
          $(widget.widget).trigger("SSWidgetResized");
        }
      }
      else {
        $(widget.widget).trigger("SSWidgetResized");
      }
    });
  }, 30);
});

// Widget Initialization
$(document).ready(function() {
  soysauce.init();
  if (soysauce.vars.degradeAll) {
    $("body").attr("data-ss-degrade", "true");
  }
  soysauce.widgets.forEach(function(obj) {
    if (!obj.defer) return;
    var deferCount = 0;
    var innerWidgets = obj.widget.find("[data-ss-widget]");
    innerWidgets.each(function() {
      var widget = soysauce.fetch(this);
      if (widget.initialized) {
        if (++deferCount === innerWidgets.length) {
          $(obj.widget).trigger("SSWidgetReady").removeAttr("data-ss-defer");
          return;
        }
      }
      else {
        widget.widget.on("SSWidgetReady", function() {
          if (++deferCount === innerWidgets.length) {
            $(obj.widget).trigger("SSWidgetReady").removeAttr("data-ss-defer");
          }
        });
      }
    });
  });
  // Set HammerJS Options
  try {
    Hammer.gestures.Swipe.defaults.swipe_velocity = 0.35;
    Hammer.gestures.Drag.defaults.drag_min_distance = 1;
    Hammer.gestures.Drag.defaults.drag_lock_min_distance = 1;
    Hammer.gestures.Drag.defaults.drag_lock_to_axis = true;
  }
  catch(e) {
    console.warn("Soysauce: Error setting options with HammerJS");
    console.error(e);
  }
  
  $(window).trigger("SSReady");
});

$(window).load(function() {
  var cachedLazyLoader = soysauce.fetch("[data-ss-widget='lazyloader'][data-ss-options*='cache']");
  if (cachedLazyLoader && cachedLazyLoader.isCached) return;
  if (!$(this).scrollTop()) {
    soysauce.scrollTop();
  }
});

}

soysauce.ajax = function(url, callback, forceAjax) {
  var result = false;
  var success = true;
  
  if (soysauce.browser.supportsSessionStorage && sessionStorage[url]) {
    try {
      result = JSON.parse(sessionStorage[url]);
      if (!forceAjax) {
        if (typeof(callback) === "function") {
          return callback(result, "success");
        }
        else {
          return result;
        }
      }
    }
    catch(e) {}
  }
  $.ajax({
    url: url,
    async: (!callback) ? false : true
  }).always(function(data, status, jqXHR) {
    try {
      var resultString = JSON.stringify(data);
      result = JSON.parse(resultString);
      sessionStorage.setItem(url, resultString);
    }
    catch(e) {
      if (e.code === DOMException.QUOTA_EXCEEDED_ERR) {
        console.warn("Soysauce: sessionStorage is full.");
      }
      else {
        console.log("error message: " + e.message);
        console.warn("Soysauce: error fetching url '" + url + "'. Data returned needs to be JSON.");
        result = false;
      }
    }
    if (typeof(callback) === "function") {
      return callback(result, status);
    }
  });
  return result;
};

soysauce.freezeChildren = function(selector) {
  var children = $("[data-ss-id='" + selector + "']").find("[data-ss-widget]");
  children.each(function(index, child) {
    var id = $(child).attr("data-ss-id");
    soysauce.freeze(id, false);
  });
};

soysauce.freeze = function(selector, freezeChildren) {
  if (typeof(selector) === "object") {
    selector = parseInt($(selector).attr("data-ss-id"), 10);
  }
  freezeChildren = (!freezeChildren) ? true : false;
  soysauce.fetch(selector).handleFreeze();
  if (freezeChildren) {
    soysauce.freezeChildren(selector);
  }
};

soysauce.unfreeze = function(selector) {
  if (typeof(selector) === "object") {
    selector = parseInt($(selector).attr("data-ss-id"), 10);
  }
  var children = $("[data-ss-id='" + selector + "']").find("[data-ss-widget]");
  soysauce.fetch(selector).handleUnfreeze();
  children.each(function(index, child) {
    var id = $(child).attr("data-ss-id");
    soysauce.fetch(id).handleUnfreeze();
  });
};

soysauce.init = function(selector, manual) {
  var set;
  var numItems = 0;
  var ret = false;
  var fastclickSelectors = "";
  
  fastclickSelectors = "[data-ss-widget='toggler'] > [data-ss-component='button']";
  fastclickSelectors += ", [data-ss-component='button'][data-ss-toggler-id]";
  fastclickSelectors += ", [data-ss-widget='carousel'] [data-ss-component='button']";
  fastclickSelectors += ", [data-ss-widget='carousel'] [data-ss-component='dots']";
  fastclickSelectors += ", [data-ss-utility='overlay'] [data-ss-component='close']";
  
  $(fastclickSelectors).each(function() {
    try {
      soysauce.vars.fastclick.push(FastClick.attach(this));
    }
    catch(e) {
      console.warn("Soysauce: Could not attach Fastclick listener on soysauce component. " + e.message);
    }
  });
  
  if (!selector) {
    set = $("[data-ss-widget]:not([data-ss-id]), [data-ss-component='button'][data-ss-toggler-id]");
  }
  else {
    set = $(selector);
  }
  
  if ((!$(selector) && !set) || $(selector).attr("data-ss-id") !== undefined) return ret;
  
  numItems = set.length;
  
  set.each(function(i) {
    var $this = $(this);
    var type = $(this).attr("data-ss-widget");
    var widget;
    var orphan = false;
    
    if (!type && $this.attr("data-ss-toggler-id") !== undefined) {
      type = "toggler";
      orphan = true;
    }
    
    if (!manual && /manual/.test($this.attr("data-ss-init"))) {
      return;
    }
    
    $this.attr("data-ss-id", ++soysauce.vars.idCount);
    
    switch (type) {
      case "toggler":
        widget = soysauce.togglers.init(this, orphan);
        break;
      case "carousel":
        widget = soysauce.carousels.init(this);
        break;
      case "lazyloader":
        widget = soysauce.lazyloader.init(this);
        break;
      case "autofill-zip":
        widget = soysauce.autofillZip.init(this);
        break;
      case "autodetect-cc":
        widget = soysauce.autodetectCC.init(this);
        break;
      case "autosuggest":
        widget = soysauce.autosuggest.init(this);
        break;
      case "input-clear":
        widget = soysauce.inputClear.init(this);
        break;
    }

    if (widget !== undefined) {
      widget.type = type;
      widget.id = soysauce.vars.idCount;
      soysauce.widgets.push(widget);
      ret = true;
      if ($this.attr("data-ss-defer") !== undefined) {
        widget.defer = true;
      }
      else {
        $this.imagesLoaded(function() {
          widget.initialized = true;
          $this.trigger("SSWidgetReady");
        });
      }
    }
    else {
      $this.removeAttr("data-ss-id");
      --soysauce.vars.idCount;
    }
  });
  
  return ret;
}

soysauce.lateload = function(selector) {
  
  function loadItem(selector) {
    var curr = $(selector);
    var val = curr.attr("data-ss-ll-src");
    if (val) {
      curr.attr("src", val).removeAttr("data-ss-ll-src");
      return true;
    }
    return false;
  }
  
  if (selector) {
    return loadItem(selector);
  }
  else {
    $(document).on("DOMContentLoaded", function() {
      $("[data-ss-ll-src][data-ss-options='dom']").each(function(i, e) {
        loadItem(e);
      });
    });
    $(window).on("load", function() {
      if (!$("[data-ss-ll-src][data-ss-options='load']")) return;
      $("[data-ss-ll-src][data-ss-options='load']").each(function(i, e) {
        loadItem(e);
      });
    });
  }
};

soysauce.lateload();

soysauce.overlay = (function() {
  var TRANSITION_END = "transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd";
  var $body = $("body");
  var $viewport = $("meta[name='viewport']");
  
  function Overlay() {
    var self = this;
    
    this.overlay;
    this.content;
    this.close;
    this.hiddenItems = null;
    this.isOn = false;
    
    $(document).ready(function() {
      self.init();
    });
  };
  
  Overlay.prototype.init = function(selector) {
    var div = document.createElement("div");
    var self = this;

    if ($("[data-ss-utility='overlay']").length) return false;

    div.setAttribute("data-ss-utility", "overlay");
    div.setAttribute("data-ss-state", "inactive");
    
    document.body.appendChild(div);

    this.overlay = $("[data-ss-utility='overlay']");

    this.overlay.append("<div data-ss-component='close'>tap to close</div>");
    this.close = this.overlay.find("[data-ss-component='close']");
    
    this.overlay.append("<div data-ss-component='content'></div>");
    this.content = this.overlay.find("[data-ss-component='content']");

    this.close.on("click", function() {
      self.off();
    });

    return true;
  };
  
  Overlay.prototype.on = function(selector, css, showClose) {
    var self = this;
    
    if (this.isOn) return;
    
    if (typeof(selector) === "string") {
      this.overlay.appendTo(selector);
    }
    
    this.overlay.show();
    
    if (showClose) {
      this.close.show();
    }
    
    window.setTimeout(function() {
      if (css) {
        try {
          JSON.stringify(css);
          self.overlay.css(css);
        }
        catch(e) {
          console.warn("Soysauce: Could not attach css; need to pass JSON css object");
        }
      }
      self.overlay.attr("data-ss-state","active");
      self.isOn = true;
    }, 0);
  };
  
  Overlay.prototype.off = function() {
    if (!this.isOn) return;
    
    this.isOn = false;
    this.overlay.attr("data-ss-state","inactive").removeAttr("style").hide();
    this.overlay.appendTo("body");
    
    this.content.find("[data-ss-widget]").each(function() {
      soysauce.destroy(this);
    });
    
    this.content.empty();
    
    $body.css({
      "overflow": "",
      "height": ""
    });
    
    if (this.hiddenItems) {
      this.hiddenItems.show();
      this.hiddenItems = null;
    }
  };
  
  Overlay.prototype.toggle = function() {
    if (this.isOn) {
      this.off();
    }
    else {
      this.on();
    }
  };
  
  Overlay.prototype.injectCarousel = function(carousel, css) {
    var items = carousel.items.clone();
    var $carousel;
    var self = this;
    var showCloseButton = true;
    var additionalOptions = "";
    
    this.on(null, css, showCloseButton);
    
    if (carousel.infinite) {
      items = items.slice(1, carousel.numChildren - 1);
    }
    else {
      additionalOptions += "finite";
    }
    
    items.removeAttr("data-ss-state").removeAttr("style");
    this.content.wrapInner("<div data-ss-widget='carousel' data-ss-options='overlay " + additionalOptions + "' data-ss-index=" + carousel.index + "/>");
    
    $carousel = this.content.find("[data-ss-widget='carousel']");
    $carousel.append(items);
    
    this.overlay.one(TRANSITION_END, function() {
      $carousel.one("SSWidgetReady", function() {
        $body.css({
          "overflow": "hidden",
          "height": "100%"
        });
        self.hiddenItems = $body.find("> *:not([data-ss-utility]):not(#ios7fix)");
        self.hiddenItems.hide();
      });
      soysauce.init($carousel[0]);
    });
  };
  
  Overlay.prototype.hideAssets = function() {
    this.close.css("opacity", "0");
  };
  
  Overlay.prototype.showAssets = function() {
    this.close.css("opacity", "1");
  };
  
  return new Overlay();
  
})();

soysauce.autodetectCC = (function() {
  
  function autodetectCC(selector) {
    var options = soysauce.getOptions(selector);
    var self = this;
    
    this.widget = $(this);
    this.input = $(selector);
    this.prediction;
    this.result;
    this.format = false;
    this.valid = false;
    
    if (options) options.forEach(function(option) {
      switch(option) {
        case "format":
          self.format = (soysauce.vars.degrade2) ? false : true;
          break;
      }
    });
    
    if (this.format) {
      this.input.attr("maxlength", "19");
    }
    else {
      this.input.attr("maxlength", "16");
    }
    
    if (this.format && soysauce.vars.degrade) {
      this.input.on("keydown", function(e) {
        var keycode = e.keyCode ? e.keyCode : e.which;
        if (keycode !== 8 && keycode !== 46 && keycode !== 91 && keycode !== 17 && keycode !== 189) {
          soysauce.stifle(e);
          self.input.val(this.value + String.fromCharCode(e.keyCode));
        }
      });
    }
    
    this.input.on("keyup change", function(e) {
      var card_num = e.target.value.replace(/[-\s]+/g, "");
      var keycode = e.keyCode ? e.keyCode : e.which;
      var result;

      // State 1 - Prediction
      if (card_num.length) {
        if (card_num.match(/^4/)) {
          self.prediction = "visa";
        } 
        else if (card_num.match(/^5/)) {
          self.prediction = "mastercard";
        } 
        else if (card_num.match(/^6/)) {
          self.prediction = "discover";
        } 
        else if (card_num.match(/^3/)) {
          if (card_num.length === 1) {
            self.prediction = "amex dinersclub jcb";
          }
          else {
            if (card_num.match(/^3(4|7)/)) {
              self.prediction = "amex";
            }
            else if (card_num.match(/^3(0|8)/)) {
              self.prediction = "dinersclub";
            }
            else if (card_num.match(/^35/)) {
              self.prediction = "jcb";
            }
          }
        }
        else {
          self.prediction = null;
        }
        $(e.target).trigger("SSPrediction");
      }
      else {
        $(e.target).trigger("SSEmpty");
        self.prediction = null;
      }
    
      // State 2 - Result
      if (/visa/.test(self.prediction) && card_num.length >= 13) {
        if (validCC(card_num)) {
          self.valid = (/^4[0-9]{12}(?:[0-9]{3})?$/.test(card_num)) ? true : false;
          result = "visa";
        }
        else {
          self.valid = false;
        }
      }
      if (/mastercard/.test(self.prediction) && card_num.length === 16) {
        if (validCC(card_num)) {
          self.valid = (card_num.match(/^5[1-5][0-9]{14}$/)) ? true : false;
          result = "mastercard";
        }
        else {
          self.valid = false;
        }
      }
      if (/amex/.test(self.prediction) && card_num.length >= 15) {
        if (validCC(card_num)) {
          self.valid = (card_num.match(/^3[47][0-9]{13}$/)) ? true : false;
          result = "amex";
        }
        else {
          self.valid = false;
        }
      }
      if (/dinersclub/.test(self.prediction) && card_num.length >= 14) {
        if (validCC(card_num)) {
          self.valid = (card_num.match(/^3(?:0[0-5]|[68][0-9])[0-9]{11}$/)) ? true : false;
          result = "dinersclub";
        }
        else {
          self.valid = false;
        }
      }
      if (/discover/.test(self.prediction) && card_num.length === 16) {
        if (validCC(card_num)) {
          self.valid = (card_num.match(/^6(?:011|5[0-9]{2})[0-9]{12}$/)) ? true : false;
          result = "discover";
        }
        else {
          self.valid = false;
        }
      }
      if (/jcb/.test(self.prediction) && card_num.length === 16) {
        if (validCC(card_num)) {
          self.valid = (card_num.match(/^(?:2131|1800|35\d{3})\d{11}$/)) ? true : false;
          result = "jcb";
        }
        else {
          self.valid = false;
        }
      }
      
      if (self.valid && result) {
        self.result = result;
        $(e.target).trigger("SSResult");
      }
      else {
        self.result = null;
        if (!self.prediction && card_num.length === 16 ||
            /visa/.test(self.prediction) && card_num.length === 13 ||
            /visa|mastercard|discover|dinersclub|jcb/.test(self.prediction) && card_num.length === 16 ||
            /amex/.test(self.prediction) && card_num.length === 15) {
          $(e.target).trigger("SSResult");
        }
      }
      // keycodes: 8 = backspace, 46 = delete, 91 = command, 17 = ctrl, 189 = dash
      if (self.format && card_num.length > 3 && 
        keycode !== 8 && keycode !== 46 && keycode !== 91 && keycode !== 17 && keycode !== 189) {
        self.formatInput(e);
      }
    });
  }
  
  autodetectCC.prototype.formatInput = function(e) {
    var val = this.input.val().replace(/[\s]+/g, "");
    var isAmex = (/^3[47]/.test(val.replace(/[-\s]+/g, ""))) ? true : false;
    var isDC = (/^3(?:0[0-5]|[68][0-9])/.test(val.replace(/[-\s]+/g, "")) && !isAmex) ? true : false;
    
    if (soysauce.vars.degrade) {
      setCursorToEnd(this.input[0]);
    }
    
    if (isAmex || isDC) {
      if (val[4] !== undefined && val[4] !== "-") {
        val = insertStringAt("-", 4, val);
        this.input.val(val);
      }
      if (val[11] !== undefined && val[11] !== "-") {
        val = insertStringAt("-", 11, val);
        this.input.val(val);
      }
    }
    else {
      if (val[4] !== undefined && val[4] !== "-") {
        val = insertStringAt("-", 4, val);
        this.input.val(val);
      }
      if (val[9] !== undefined && val[9] !== "-") {
        val = insertStringAt("-", 9, val);
        this.input.val(val);
      }
      if (val[14] !== undefined && val[14] !== "-") {
        val = insertStringAt("-", 14, val)
        this.input.val(val);
      }
    }
    
    function insertStringAt(content, index, dest) {
      if (index > 0) {
        return dest.substring(0, index) + content + dest.substring(index, dest.length);
      }
      else {
        return content + dest;
      }
    }
  };
  
  function setCursorToEnd(input) {
    var index = input.length;
    input.setSelectionRange(19, 19);
  }
  
  // Luhn Algorithm, Copyright (c) 2011 Thomas Fuchs, http://mir.aculo.us
  // https://gist.github.com/madrobby/976805
  function validCC(a,b,c,d,e){for(d=+a[b=a.length-1],e=0;b--;)c=+a[b],d+=++e%2?2*c%10+(c>4):c;return!(d%10)};
  
  return {
    init: function(selector) {
      return new autodetectCC(selector);
    }
  };
  
})();

soysauce.autofillZip = (function() {
  var BASE_URL = "//jeocoder.herokuapp.com/zips/";
  var AOL_URL = "//www.mapquestapi.com/geocoding/v1/reverse?key=Fmjtd%7Cluub2l6tnu%2Ca5%3Do5-96tw0f";
  
  function autofillZip(selector) {
    var options = soysauce.getOptions(selector);
    var self = this;
    
    this.widget = $(selector);
    this.zip = this.widget.find("[data-ss-component='zip']");
    this.city = this.widget.find("[data-ss-component='city']");
    this.state = this.widget.find("[data-ss-component='state']");
    this.lastRequestedData;
    this.freeze = false;
    
    // Reverse Geocode Variables
    this.reverse = false;
    this.reverseGeocodeButton = this.widget.find("[data-ss-component='reverse-geocode']");
    
    if (options) options.forEach(function(option) {
      switch(option) {
        case "reverse":
          self.reverse = true;
          break;
      }
    });
    
    if (this.reverse) {
      this.reverseGeocodeButton.on("click", function() {
        self.reverseGeocode();
      });
    }
    else {
      this.zip.on("keyup change", function() {
        self.getLocationData();
      });
    }
  }
  
  autofillZip.prototype.reverseGeocode = function() {
    var self = this;
    
    if (!navigator.geolocation || this.freeze) return;
    
    self.widget.trigger("SSDataFetch");
    
    navigator.geolocation.getCurrentPosition(success, error, options);
    
    var options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    };

    function success(data) {
      var src = AOL_URL + "&lat=" + data.coords.latitude + "&lng=" + data.coords.longitude + "&callback=soysauce.fetch(" + self.id + ").setLocationData";
      $("body").append("<script src='" + src + "'></script>");
    };

    function error(err) {
      console.warn("Soysauce (err " + err.code + ") could not fetch data: " + err.message);
      self.widget.trigger("SSDataError");
    };
  };
  
  autofillZip.prototype.setLocationData = function(data) {
    var self = this;
    var city = data.city;
    var state = data.state;
    
    if (this.freeze) return;
    
    this.lastRequestedData = data;
    this.widget.trigger("SSDataReady");
    
    if (this.reverse) {
      this.zip.val(data.results[0].locations[0].postalCode);
    }
    else {
      this.city.val(city);
      this.state.val(state);
    }
  };
  
  autofillZip.prototype.getLocationData = function() {
    var self = this;
    var value = this.zip[0].value;
    
    if (this.freeze) return;
    
    if ((value.length === 5) && (parseFloat(value, 10) == parseInt(value, 10)) && !isNaN(value))  {
      this.widget.trigger("SSDataFetch");
      $.ajax({
        dataType: "json",
        url: BASE_URL + value,
        success: function(data) {
          self.setLocationData(data);
        },
        error: function() {
          self.widget.trigger("SSDataError");
          console.warn("Soysauce: Could not fetch zip code " + value);
        }
      });
    }
  };
  
  autofillZip.prototype.handleFreeze = function() {
    this.freeze = true;
  };
  
  autofillZip.prototype.handleUnfreeze = function() {
    this.freeze = false;
  };
  
  return {
    init: function(selector) {
      return new autofillZip(selector);
    }
  };
  
})();

soysauce.autosuggest = (function() {

  function AutoSuggest(selector) {
    var options = soysauce.getOptions(selector);
    var self = this;

    this.widget = $(selector);
    this.input = $(selector);
    
    if (options)
      options.forEach(function(option) {
        switch (option) {
          case "option1":
            break;
        }
      });

    var defaults = {  
      url: undefined,
      data: undefined,
      minCharacters: 1,
      maxResults: 10,
      wildCard: '',
      caseSensitive: false,
      notCharacter: '!',
      maxHeight: 350,
      highlightMatches: true,
      onSelect: undefined,
      width: undefined,
      property: 'text'
    };
    this.acSettings = defaults//$.extend(defaults, options);  
    
    
    this.obj = $(selector);
    this.wildCardPatt = new RegExp(self.regexEscape(this.acSettings.wildCard || ''),'g')
    this.results = $('<ul />');
    this.currentSelection = undefined;
    this.pageX =undefined;
    this.pageY =undefined;
    this.getJSONTimeout = 0;
    
    // Prepare the input box to show suggest results by adding in the events
    // that will initiate the search and placing the element on the page
    // that will show the results.
    $(this.results).addClass('jsonSuggest ui-autocomplete ui-menu ui-widget ui-widget-content ui-corner-all').
      attr('role', 'listbox').
      css({
        'xtop': (this.obj.position().top + this.obj.outerHeight()) + 'px',
        'xleft': this.obj.position().left + 'px',
        'width': this.acSettings.width || (this.obj.outerWidth() + 'px'),
        'z-index': 1000000,
        'position':'absolute',
        'background-color': 'black'
      }).hide();
    
    
    this.obj.after(this.results).
      keyup(function (e){
        switch (e.keyCode) {
          case 13: // return key
            $(self.currentSelection).trigger('click');
            return false;
          case 40: // down key
            if (typeof self.currentSelection === 'undefined') {
              self.currentSelection = $('li:first', self.results).get(0);
            }
            else {
              self.currentSelection = $(self.currentSelection).next().get(0);
            }

            self.setHoverClass(self.currentSelection);
            if (self.currentSelection) {
              $(self.results).scrollTop(self.currentSelection.offsetTop);
            }

            return false;
          case 38: // up key
            if (typeof self.currentSelection === 'undefined') {
              self.currentSelection = $('li:last', self.results).get(0);
            }
            else {
              self.currentSelection = $(self.currentSelection).prev().get(0);
            }

            self.setHoverClass(self.currentSelection);
            if (self.currentSelection) {
              $(self.results).scrollTop(self.currentSelection.offsetTop);
            }

            return false;
          default:
            self.runSuggest.apply(this, [e, self]);
        }
      }).
      keydown(function(e) {
        // for tab/enter key
        if ((e.keyCode === 9 || e.keyCode === 13) && self.currentSelection) {
          $(self.currentSelection).trigger('click');
          return true;
        }
      }).
      blur(function(e) {
        // We need to make sure we don't hide the result set
        // if the input blur event is called because of clicking on
        // a result item.
        var resPos = $(self.results).offset();
        resPos.bottom = resPos.top + $(self.results).height();
        resPos.right = resPos.left + $(self.results).width();

        if (pageY < resPos.top || pageY > resPos.bottom || pageX < resPos.left || pageX > resPos.right) {
          $(self.results).hide();
        }
      }).
      focus(function(e) {
        $(this.results).css({
          'top': (self.obj.position().top + self.obj.outerHeight()) + 'px',
          'left': self.obj.position().left + 'px'
        });

        if ($('li', self.results).length > 0) {
          $(self.results).show();
        }
      }).
      attr('autocomplete', 'off');
    
    
    $(window).mousemove(function(e) {
      this.pageX = e.pageX;
      this.pageY = e.pageY;
    });
    
    
    // Escape the not character if present so that it doesn't act in the regular expression
    this.acSettings.notCharacter = self.regexEscape(this.acSettings.notCharacter || '');

    //if we have a url for json, grab it and parse
    if (this.widget.attr("data-ss-suggest-json-file"))
    $.ajax({
      url: this.widget.attr("data-ss-suggest-json-file"),
      dataType: 'json',
      async: false,
      success: function(data) {
        self.acSettings.data = data;
      }
    });

    // Make sure the JSON data is a JavaScript object if given as a string.
    if (this.acSettings.data && typeof this.acSettings.data === 'string') {
      this.acSettings.data = $.parseJSON(this.acSettings.data);
    }
    
    $(this.obj).trigger("SSLoaded");
  };

  AutoSuggest.prototype.handleResize = function() {
    // Placeholder - required soysauce function
  };
  
  /**
  * Escape some text so that it can be used inside a regular expression
  * without implying regular expression rules iself. 
  */
  AutoSuggest.prototype.regexEscape = function(txt, omit) {
    var specials = ['/', '.', '*', '+', '?', '|',
            '(', ')', '[', ']', '{', '}', '\\'];

    if (omit) {
      for (var i = 0; i < specials.length; i++) {
        if (specials[i] === omit) { specials.splice(i,1); }
      }
    }

    var escapePatt = new RegExp('(\\' + specials.join('|\\') + ')', 'g');
    return txt.replace(escapePatt, '\\$1');
  }
  
  /**
  * When an item has been selected then update the input box,
  * hide the results again and if set, call the onSelect function.
  */
  AutoSuggest.prototype.selectResultItem = function(item) {
    this.obj.val(item[this.acSettings.property]);
    this.widget.trigger("SSAutoSuggested", {
      suggestion: item
    });
    $(this.results).html('').hide();

    if (typeof this.acSettings.onSelect === 'function') {
      this.acSettings.onSelect(item);
    }
  }
  
  /**
  * Used to get rid of the hover class on all result item elements in the
  * current set of results and add it only to the given element. We also
  * need to set the current selection to the given element here.
  */
  AutoSuggest.prototype.setHoverClass = function(el) {
    $('li a', this.results).removeClass('ui-state-hover');
    if (el) {
      $('a', el).addClass('ui-state-hover');
    }

    this.currentSelection = el;
  }
  
  /**
  * Build the results HTML based on an array of objects that matched
  * the search criteria, highlight the matches if that feature is turned 
  * on in the settings.
  */
  AutoSuggest.prototype.buildResults = function(resultObjects, filterTxt) {
    filterTxt = '(' + filterTxt + ')';
    
    var saveSelf = this;

    var bOddRow = true, i, iFound = 0,
      filterPatt = this.acSettings.caseSensitive ? new RegExp(filterTxt, 'g') : new RegExp(filterTxt, 'ig');

    $(this.results).html('').hide();

    for (i = 0; i < resultObjects.length; i += 1) {
      var item = $('<li />'),
        text = resultObjects[i][this.acSettings.property];

      if (this.acSettings.highlightMatches === true) {
        text = text.replace(filterPatt, '<strong>$1</strong>');
      }

      $(item).append('<a class="ui-corner-all">' + text + '</a>');

      if (typeof resultObjects[i].image === 'string') {
        $('>a', item).prepend('<img src="' + resultObjects[i].image + '" />');
      }

      if (typeof resultObjects[i].extra === 'string') {
        $('>a', item).append('<small>' + resultObjects[i].extra + '</small>');
      }

      
      $(item).addClass('ui-menu-item').
        addClass((bOddRow) ? 'odd' : 'even').
        attr('role', 'menuitem').
        click((function(n) { return function() {
          saveSelf.selectResultItem(resultObjects[n]);            
        };})(i)).
        mouseover((function(el) { return function() { 
          saveSelf.setHoverClass(el); 
        };})(item));

      $(this.results).append(item);

      bOddRow = !bOddRow;

      iFound += 1;
      if (typeof this.acSettings.maxResults === 'number' && iFound >= this.acSettings.maxResults) {
        break;
      }
    }

    if ($('li', this.results).length > 0) {
      this.currentSelection = undefined;
      $(this.results).show().css('height', 'auto');

      if ($(this.results).height() > this.acSettings.maxHeight) {
        $(this.results).css({'overflow': 'auto', 'height': this.acSettings.maxHeight + 'px'});
      }
    }
  }
  
  /**
  * Prepare the search data based on the settings for this plugin,
  * run a match against each item in the possible results and display any 
  * results on the page allowing selection by the user.
  */
  AutoSuggest.prototype.runSuggest = function(e, self) {  
    var search = function(searchData) {
      if (this.value.length < self.acSettings.minCharacters) {
        self.clearAndHideResults();
        return false;
      }

      var resultObjects = [],
        filterTxt = (!self.acSettings.wildCard) ? self.regexEscape(this.value) : self.regexEscape(this.value, self.acSettings.wildCard).replace(wildCardPatt, '.*'),
        bMatch = true, 
        filterPatt, i;

      if (self.acSettings.notCharacter && filterTxt.indexOf(self.acSettings.notCharacter) === 0) {
        filterTxt = filterTxt.substr(self.acSettings.notCharacter.length,filterTxt.length);
        if (filterTxt.length > 0) { bMatch = false; }
      }
      filterTxt = filterTxt || '.*';
      filterTxt = self.acSettings.wildCard ? '^' + filterTxt : filterTxt;
      filterPatt = self.acSettings.caseSensitive ? new RegExp(filterTxt) : new RegExp(filterTxt, 'i');

      // Look for the required match against each single search data item. When the not
      // character is used we are looking for a false match. 
      for (i = 0; i < searchData.length; i += 1) {
        if (filterPatt.test(searchData[i][self.acSettings.property]) === bMatch) {
          resultObjects.push(searchData[i]);
        }
      }

      self.buildResults(resultObjects, filterTxt);
    };

    if (self.acSettings.data && self.acSettings.data.length) {
      search.apply(this, [self.acSettings.data, self]);
    }
    else if (self.acSettings.url && typeof self.acSettings.url === 'string') {
      var text = this.value;
      if (text.length < self.acSettings.minCharacters) {
        self.clearAndHideResults();
        return false;
      }

      $(self.results).html('<li class="ui-menu-item ajaxSearching"><a class="ui-corner-all">Searching...</a></li>').
        show().css('height', 'auto');

      self.getJSONTimeout = window.clearTimeout(self.getJSONTimeout);
      self.getJSONTimeout = window.setTimeout(function() {
        $.getJSON(self.acSettings.url, {search: text}, function(data) {
          if (data) {
            self.buildResults(data, text);
          }
          else {
            self.clearAndHideResults();
          }
        });
      }, 500);
    }
  }
  
  /**
  * Clears any previous results and hides the result list
  */
  AutoSuggest.prototype.clearAndHideResults = function() {
    $(this.results).html('').hide();
  }

  return {
    init: function(selector) {
      return new AutoSuggest(selector);
    }
  };

})();
soysauce.carousels = (function() {
  // Shared Default Globals
  var AUTOSCROLL_INTERVAL = 5000;
  var PEEK_WIDTH = 20;
  var TRANSITION_END = "transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd";
  var VENDOR_PREFIX = soysauce.getPrefix();
  var SWIPE_THRESHOLD = 240;
  var ZOOM_SENSITIVITY = 0.8;
  
  function Carousel(selector) {
    var options;
    var self = this;
    var wrapper;
    var dotsHtml = "";
    var numDots;

    // Base Variables
    this.widget = $(selector);
    this.index = 0;
    this.maxIndex;
    this.container;
    this.items;
    this.currentItem;
    this.itemPadding;
    this.dots;
    this.numChildren = 0;
    this.widgetWidth = 0;
    this.widgetHeight = 0;
    this.itemWidth = 0;
    this.interruptedOffset = 0;
    this.offset = 0;
    this.ready = false;
    this.interrupted = false;
    this.lockScroll = false;
    this.nextBtn;
    this.prevBtn;
    this.freeze = false;
    this.jumping = false;
    this.lastTransitionEnd = 0;
    this.sendClick = false;
    this.resizeID = 0;

    // Infinite Variables
    this.infinite = true;
    this.autoscroll = false;
    this.autoscrollID;
    this.autoscrollInterval;
    this.autoscrollRestartID;
    this.infiniteID;
    this.forward;
    this.lastSlideTime;
    this.cloneDepth = 0;
    this.looping = false;
    this.rewindCoord = 0;

    // Peek Variables
    this.peek = false;
    this.peekWidth = 0;
    this.peekAlign;

    // Swipe Variables
    this.swipe = true;
    this.swiping = false;

    // Zoom Variables
    this.zoom = false;
    this.containerZoom = false; // old zoom functionality
    this.zoomIcon;
    this.overlay = false;
    this.isZoomed = false;
    this.zoomElement = null;
    this.zoomElementCenterX = 0;
    this.zoomElementCenterY = 0;
    this.zoomElementWidth = 0;
    this.zoomElementHeight = 0;
    this.zoomElementOffset = null;
    this.zoomTranslateX = 0;
    this.zoomTranslateY = 0;
    this.zoomTranslateXStart = 0;
    this.zoomTranslateYStart = 0;
    this.zoomTranslateMinX = 0;
    this.zoomTranslateMinY = 0;
    this.zoomTranslateMaxX = 0;
    this.zoomTranslateMaxY = 0;
    this.zoomScale = 1;
    this.zoomScaleStart = 1;
    this.zoomScalePrev = 1;
    this.pinchEventsReady = false;
    this.lastZoomTap = 0;
    
    // Multi Item Variables
    this.multi = false;
    this.multiVars = {
      numItems: 2,
      stepSize: 1,
      minWidth: 0,
      even: false
    };

    // Autoheight Variables
    this.autoheight = false;

    // Fade Variables
    this.fade = false;
    
    // Single-item Options
    if (this.widget.attr("data-ss-single-options") && this.widget.find("[data-ss-component='item']").length === 1) {
      options = this.widget.attr("data-ss-single-options").split(" ");
      this.widget.attr("data-ss-single-item", "true");
    }
    else {
      options = soysauce.getOptions(selector);
    }
    
    if (options) options.forEach(function(option) {
      switch(option) {
        case "peek":
          self.peek = true;
          break;
        case "finite":
          self.infinite = false;
          break;
        case "autoscroll":
          self.autoscroll = true;
          break;
        case "noswipe":
          self.swipe = false;
          break;
        case "zoom":
          self.zoom = true;
          break;
        case "containerZoom":
          self.zoom = true;
          self.containerZoom = true;
          break;
        case "multi":
          self.multi = true;
          break;
        case "autoheight":
          self.autoheight = true;
          break;
        case "fade":
          self.fade = true;
          break;
        case "overlay":
          self.overlay = true;
          break;
      }
    });
    
    if (this.multi) {
      this.infinite = false;
    }
    
    this.widgetWidth = this.widget.outerWidth();
    this.widget.wrapInner("<div data-ss-component='container' />");
    this.widget.wrapInner("<div data-ss-component='container_wrapper' />");
    this.container = this.widget.find("[data-ss-component='container']");
    
    wrapper = this.widget.find("[data-ss-component='container_wrapper']");

    if (this.infinite) {
      wrapper.after("<div data-ss-component='button' data-ss-button-type='prev' data-ss-state='enabled'></div><div data-ss-component='button' data-ss-button-type='next'></div>");
    }
    else {
      wrapper.after("<div data-ss-component='button' data-ss-button-type='prev' data-ss-state='disabled'></div><div data-ss-component='button' data-ss-button-type='next'></div>");
    }
    wrapper.after("<div data-ss-component='dots'></div>")
    this.dots = this.widget.find("[data-ss-component='dots']");

    this.nextBtn = wrapper.find("~ [data-ss-button-type='next']");
    this.prevBtn = wrapper.find("~ [data-ss-button-type='prev']");

    wrapper.find("~ [data-ss-button-type='prev']").click(function(e) {
      soysauce.stifle(e);
      if (self.ready && !self.interrupted && !self.freeze) {
        self.slideBackward();
      }
    });

    wrapper.find("~ [data-ss-button-type='next']").click(function(e) {
      soysauce.stifle(e);
      if (self.ready && !self.interrupted && !self.freeze) {
        self.slideForward();
      }
    });

    this.maxIndex = this.widget.find("[data-ss-component='item']").length;

    if (this.multi) {
      this.multiVars.numItems = parseInt(this.widget.attr("data-ss-multi-set"), 10) || 2;
      this.multiVars.minWidth = parseInt(this.widget.attr("data-ss-multi-min-width"), 10) || 0;
      this.multiVars.stepSize = parseInt(this.widget.attr("data-ss-step-size"), 10) || this.multiVars.numItems;
      this.maxIndex = Math.ceil(this.maxIndex / this.multiVars.stepSize);
    }

    if (this.infinite) {
      if (this.multi) {
        // createClones(this, this.multiVars.numItems);
        console.warn("Soysauce: 'multi' option with infinite scrolling not yet supported. Please add 'finite' option.")
        createClones(this, 1);
      }
      else {
        createClones(this, 1);
      }
      this.lastSlideTime = new Date().getTime();
    }

    this.items = this.container.find("> [data-ss-component='item']");
    this.itemPadding = parseInt(this.items.first().css("padding-left"), 10) + parseInt(this.items.first().css("padding-right"), 10);

    if (this.multi) {
      this.multiVars.even = (this.items.length % this.multiVars.numItems === 0) ? true : false;
    }

    if (!this.items.length) {
      console.warn("Soysauce: Carousel cannot be instantiated; no items found.");
      return;
    }

    this.numChildren = this.items.length;

    if (!this.infinite) {
      wrapper.find("~ [data-ss-button-type='next']").attr("data-ss-state", (this.numChildren > 1) ? "enabled" : "disabled");
    }
    else {
      wrapper.find("~ [data-ss-button-type='next']").attr("data-ss-state", "enabled");
    }

    numDots = (this.infinite) ? this.numChildren - 2 : this.numChildren;
    numDots = (this.multi) ? this.maxIndex : numDots;

    for (i = 0; i < numDots; i++) {
      dotsHtml += "<div data-ss-component='dot'></div>";
    }

    this.dots.html(dotsHtml);
    this.dots = this.dots.find("div");
    this.dots.attr("data-ss-state", "inactive")
    this.dots.first().attr("data-ss-state", "active");
    this.dots.on("click", function(e) {
      var currXPos = parseInt(soysauce.getArrayFromMatrix(self.container.css(VENDOR_PREFIX + "transform"))[4], 10);
      var index = 0;

      if (currXPos === self.offset) {
        self.ready = true;
      }

      if (!self.ready || self.interrupted || self.freeze) return;

      soysauce.stifle(e);

      index = self.dots.index(this);

      if (self.infinite) {
        index += 1;
      }

      self.jumpTo(index);
    });

    if (this.peek) {
      this.peekAlign = this.widget.attr("data-ss-peek-align") || "center";
      this.peekWidth = parseInt(this.widget.attr("data-ss-peek-width"), 10) || PEEK_WIDTH;
      if (this.peekWidth % 2) {
        this.widget.attr("data-ss-peek-width", ++this.peekWidth);
      }
    }
    
    this.items.attr("data-ss-state", "inactive");

    this.index = parseInt(this.widget.attr("data-ss-index"), 10) || 0;

    if (this.infinite) {
      if (!this.index) {
        this.index++;
      }
      else if (this.index > this.maxIndex) {
        this.index = this.maxIndex;
      }
      $(this.items[this.index]).attr("data-ss-state", "active");
    }
    else {
      if (this.multi) {
        var $items = $(this.items.slice(0, this.multiVars.numItems));
        $items.attr("data-ss-state", "active");
      }
      else {
        $(this.items[this.index]).attr("data-ss-state", "active");
      }
    }
    
    this.container.imagesLoaded(function(items) {
      var firstItem = self.items.first();
      var margin = parseInt(firstItem.css("margin-left"), 10) + parseInt(firstItem.css("margin-right"), 10);

      if (self.multi) {
        if (self.multiVars.minWidth > 0) {
          self.multiVars.numItems = Math.floor(self.widgetWidth / self.multiVars.minWidth);
        }
        self.itemWidth = self.widgetWidth / self.multiVars.numItems;
      }
      else {
        self.itemWidth = self.widgetWidth;
      }

      $(window).load(function() {
        self.handleResize();
      });
      
      if (self.peek) {
        self.itemWidth -= self.peekWidth*2;
        switch (self.peekAlign) {
          case "center":
            self.offset += self.peekWidth;
            break;
          case "left":
            break;
          case "right":
            self.offset += (self.peekWidth * 2);
            break;
        }
      }

      if (!self.fade) {
        self.container.width((self.itemWidth + margin) * self.numChildren);
        self.items.css("width", self.itemWidth + "px");
      }

      self.offset -= (self.itemWidth * self.index);
      
      self.container.attr("data-ss-state", "notransition");
      setTranslate(self.container[0], self.offset);
      
      self.widgetHeight = self.widget.outerHeight(true);
      
      if (self.overlay || self.zoomContainer) {
        self.setZoomCenterPoint();
      }
    });
    
    this.container.hammer().on("release click", function(e) {
      if (e.type === "click") {
        if (self.sendClick) {
          return;
        }
        else {
          soysauce.stifle(e);
          return false;
        }
      }
      
      if (e.type === "release") {
        if (e.gesture.distance === 0 && !self.swiping && !self.isZoomed && !self.lockScroll) {
          self.sendClick = true;
        }
        else {
          self.sendClick = false;
        }
      }
    });

    if (this.swipe) {
      // Temporary Fix - Fixes iOS 7 swipe issue
      if (/iphone os 7/i.test(navigator.userAgent)) {
        var $ios7fix = $("#ios7fix");
        if (!$ios7fix.length) {
          $("body").append("<div id='ios7fix' style='color: transparent; z-index: -1; height: 1px; width: 1px; position: absolute; top: 0; left: 0;'></div>");
        } 
        this.container.on("touchmove touchend", function(e) {
          $ios7fix.html(e.type);
        });
      }
      // end of temp fix
      this.container.hammer().on("touch release drag swipe", function(e) {
        if (self.freeze) return;
        self.handleSwipe(e);
      });
    }
    
    if (this.zoom) {
      wrapper.after("<div data-ss-component='zoom_icon' data-ss-state='out'></div>");
      this.zoomIcon = wrapper.find("~ [data-ss-component='zoom_icon']");
      if (this.containerZoom) {
        this.zoomIcon.hammer().on("tap", function(e) {
          self.handleContainerZoom(e, true);
        });
        this.container.hammer().on("tap drag", function(e) {
          if (self.lockScroll) return;
          if (e.type === "drag") {
            soysauce.stifle(e);
          }
          self.handleContainerZoom(e);
        });
      }
      else {
        this.container.hammer().on("tap", function(e) {
          self.zoomIn(e);
        });
      }
    }
    
    this.currentItem = $(this.items.get(self.index));

    if (this.overlay) {
      this.zoomElement = this.currentItem;
      this.container.hammer().on("pinch doubletap drag", function(e) {
        if (!/pinch|doubletap|drag/.test(e.type)) return;
        self.handleZoom(e);
      });
    }
    
    this.container.on(TRANSITION_END, function(e) {
      self.setTransitionedStates(e);
    });
    
    if (this.autoscroll) {
      this.autoscrollOn();
    }

    if (this.autoheight) {
      var height = $(this.items[this.index]).outerHeight(true);
      this.widget.css("min-height", height);
    }
    
    this.widget.one("SSWidgetReady", function() {
      self.widget.attr("data-ss-state", "ready");
      self.ready = true;
      window.setTimeout(function() {
        self.container.attr("data-ss-state", "ready");
      }, 0);
      if (self.autoheight) {
        var height = $(self.items[self.index]).outerHeight(true);
        self.widget.css("height", height);
        window.setTimeout(function() {
          self.widget.css("min-height", "0px");
        }, 300);
      }
    });
  } // End Constructor
  
  Carousel.prototype.handleZoom = function(e) {
    var self = this;
    
    if (this.swiping) return;
    
    soysauce.stifle(e);
    
    if (e.type === "doubletap") {
      if (e.timeStamp - this.lastZoomTap < 500) return;
      
      this.zoomElement = this.currentItem;
      this.lastZoomTap = e.timeStamp;
      
      this.handleFreeze();
      
      this.zoomScalePrev = this.zoomScale;
      
      if (this.zoomScale < 1.5) {
        this.zoomElement.attr("data-ss-state", "zooming");
        this.zoomScale = 1.5
        this.isZoomed = true;
      }
      else if (this.zoomScale < 2.5) {
        this.zoomElement.attr("data-ss-state", "zooming");
        this.zoomScale = 2.5;
        this.isZoomed = true;
      }
      else {
        this.zoomElement.attr("data-ss-state", "active");
        this.zoomScale = 1;
        this.isZoomed = false;
      }
      
      this.zoomScaleStart = this.zoomScale;
      this.zoomTranslateXStart = this.zoomTranslateX;
      this.zoomTranslateYStart = this.zoomTranslateY;

      if (this.zoomScale > 1) {
        this.setFocusPoint(e);
        this.calcTranslateLimits();
        this.setTranslateLimits();
      }
      else {
        window.setTimeout(function() {
          self.resetZoomState();
        }, 0);
        return;
      }
      
      window.setTimeout(function() {
        setMatrix(self.zoomElement[0], self.zoomScale, self.zoomTranslateX, self.zoomTranslateY);
        if (self.zoomScale === 1) {
          self.handleUnfreeze();
        }
      }, 0);
    }
    else if (e.type === "pinch") {
      if (!this.pinchEventsReady) {
        this.zoomElement = this.currentItem;
        this.zoomElement.attr("data-ss-state", "zooming");

        this.zoomScalePrev = this.zoomScale;
        this.zoomScaleStart = this.zoomScale;
        
        this.zoomTranslateXStart = this.zoomTranslateX;
        this.zoomTranslateYStart = this.zoomTranslateY;
        
        this.isZoomed = true;
        this.handleFreeze();
        
        this.container.one("touchend", function() {
          if (self.zoomScale <= 1) {
            self.zoomElement.attr("data-ss-state", "active");
          }
        });
        
        this.container.hammer().one("release", function(releaseEvent) {
          soysauce.stifle(releaseEvent);

          self.pinchEventsReady = false;

          if (self.zoomScale <= 1) {
            self.resetZoomState();
            return;
          }
          
          if (self.zoomScale > 4) {
            self.zoomScale = 4;
            self.zoomScaleStart = self.zoomScale;
            return;
          }
          
          self.zoomScaleStart = self.zoomScale;

          setMatrix(self.zoomElement[0], self.zoomScale, self.zoomTranslateX, self.zoomTranslateY);
        });
        
        this.pinchEventsReady = true;
      }
      
      this.zoomScale = (((e.gesture.scale - 1) * ZOOM_SENSITIVITY) * this.zoomScaleStart) + this.zoomScaleStart;
      this.zoomScale = (this.zoomScale < 0.3) ? 0.3 : this.zoomScale;
      
      if (this.zoomScale >= 4) {
        this.zoomScale = 4;
        return;
      }
      
      this.setFocusPoint(e);
      this.calcTranslateLimits();
      this.setTranslateLimits();
      
      this.zoomElement.attr("data-ss-state", "zooming");
      
      if (this.zoomScale < 1) {
        var zoomScale = (((e.gesture.scale - 1) * ZOOM_SENSITIVITY) * this.zoomScaleStart) + this.zoomScaleStart;
        setMatrix(this.zoomElement[0], zoomScale, 0, 0);
      }
      else {
        setMatrix(this.zoomElement[0], this.zoomScale, this.zoomTranslateX, this.zoomTranslateY);
      }
    }
    else if (this.isZoomed) {
      if (!this.panning) {
        this.panning = true;
        
        this.zoomTranslateXStart = this.zoomTranslateX;
        this.zoomTranslateYStart = this.zoomTranslateY;
        
        this.container.hammer().one("release", function(releaseEvent) {
          self.panning = false;
        });
      }
      
      this.zoomTranslateX = e.gesture.deltaX + this.zoomTranslateXStart;
      this.zoomTranslateY = e.gesture.deltaY + this.zoomTranslateYStart;
      
      this.setTranslateLimits();
      
      setMatrix(this.zoomElement[0], this.zoomScale, this.zoomTranslateX, this.zoomTranslateY);
    }
  };
  
  Carousel.prototype.setZoomCenterPoint = function() {
    this.zoomElementWidth = this.zoomElement.width();
    this.zoomElementHeight = this.zoomElement.height();
    this.zoomElementOffset = this.widget.offset();
    this.zoomElementCenterX = (this.zoomElementWidth / 2) + this.zoomElementOffset.left;
    this.zoomElementCenterY = (this.zoomElementHeight / 2) + this.zoomElementOffset.top;
  };
  
  Carousel.prototype.setFocusPoint = function(e) {
    this.zoomTranslateX = (this.zoomElementCenterX - e.gesture.center.pageX + this.zoomTranslateXStart + this.peekWidth) * (this.zoomScale / this.zoomScalePrev);
    this.zoomTranslateY = (this.zoomElementCenterY - e.gesture.center.pageY + this.zoomTranslateYStart) * (this.zoomScale / this.zoomScalePrev);
  };
  
  Carousel.prototype.calcTranslateLimits = function() {
    var padding;
    
    if (!this.zoomElementWidth) {
      this.setZoomCenterPoint();
    }
    
    padding = (parseInt(this.zoomElement.css("padding-left"), 10) + parseInt(this.zoomElement.css("padding-right"), 10)) || 0;
    
    this.zoomTranslateMinX = (((this.zoomElementWidth * this.zoomScale) - this.zoomElementWidth) / 2) - this.peekWidth - padding;
    this.zoomTranslateMaxX = -this.zoomTranslateMinX;
    this.zoomTranslateMinY = ((this.zoomElementHeight * this.zoomScale) - this.zoomElementHeight) / 2;
    this.zoomTranslateMaxY = -this.zoomTranslateMinY;
  };
  
  Carousel.prototype.setTranslateLimits = function() {
    if (this.zoomTranslateX > this.zoomTranslateMinX) {
      this.zoomTranslateX = this.zoomTranslateMinX;
    }
    else if (this.zoomTranslateX < this.zoomTranslateMaxX) {
      this.zoomTranslateX = this.zoomTranslateMaxX;
    }
    if (this.zoomTranslateY > this.zoomTranslateMinY) {
      this.zoomTranslateY = this.zoomTranslateMinY;
    }
    else if (this.zoomTranslateY < this.zoomTranslateMaxY) {
      this.zoomTranslateY = this.zoomTranslateMaxY;
    }
  };
  
  Carousel.prototype.zoomIn = function(e) {
    if (this.overlay) return;

    soysauce.stifle(e);

    soysauce.overlay.injectCarousel(this, {
      "background": "black",
      "opacity": "1"
    });
  };
  
  Carousel.prototype.handleContainerZoom = function(e, iconTap) {
    var self = this;
    
    if (e.type === "tap") {
      this.zoomElement = this.currentItem;
      
      this.zoomElement.off();
      this.zoomElement.on(TRANSITION_END, function() {
        if (self.isZoomed) {
          self.zoomElement.attr("data-ss-state", "zoomed");
        }
      });
      
      if (!this.isZoomed) {
        this.handleFreeze();
        this.zoomScalePrev = this.zoomScale;
        this.zoomElement.attr("data-ss-state", "zooming");
        this.zoomScale = 3
        this.isZoomed = true;
      }
      else {
        this.zoomElement.attr("data-ss-state", "active");
        this.zoomScale = 1;
        this.isZoomed = false;
      }

      this.zoomScaleStart = this.zoomScale;
      this.zoomTranslateXStart = this.zoomTranslateX;
      this.zoomTranslateYStart = this.zoomTranslateY;

      if (this.isZoomed) {
        this.setZoomCenterPoint();
        if (!iconTap) {
          this.setFocusPoint(e);
        }
        this.calcTranslateLimits();
        this.setTranslateLimits();
      }
      else {
        window.setTimeout(function() {
          self.resetZoomState();
        }, 0);
        return;
      }

      window.setTimeout(function() {
        setMatrix(self.zoomElement[0], self.zoomScale, self.zoomTranslateX, self.zoomTranslateY);
        if (!self.isZoomed) {
          self.handleUnfreeze();
        }
      }, 0);
    }
    else {
      if (!this.panning) {
        this.panning = true;
        
        this.zoomTranslateXStart = this.zoomTranslateX;
        this.zoomTranslateYStart = this.zoomTranslateY;
        
        this.container.hammer().one("release", function(releaseEvent) {
          self.panning = false;
        });
      }
      
      this.zoomTranslateX = e.gesture.deltaX + this.zoomTranslateXStart;
      this.zoomTranslateY = e.gesture.deltaY + this.zoomTranslateYStart;
      
      this.setTranslateLimits();
      
      setMatrix(this.zoomElement[0], this.zoomScale, this.zoomTranslateX, this.zoomTranslateY);
    }
  };
  
  Carousel.prototype.resetZoomState = function() {
    var self = this;
    var transitionReset = (this.currentItem.attr("data-ss-state") === "active") ? true : false;
    
    this.zoomTranslateX = 0;
    this.zoomTranslateY = 0;
    this.zoomScale = 1;
    this.zoomScaleStart = 1;
    this.zoomScalePrev = 1;
    this.zoomElement = this.currentItem;
    this.isZoomed = false;
    this.setZoomCenterPoint();
    this.handleUnfreeze();
    
    setMatrix(this.zoomElement[0], this.zoomScale, this.zoomTranslateX, this.zoomTranslateY);
  };
  
  Carousel.prototype.handleSwipe = function(e) {
    var targetComponent = $(e.target).attr("data-ss-component");
    var self = this;
    
    if (self.jumping || self.freeze || self.looping) return;

    if (e.type === "swipe" && e.gesture.eventType === "end" && !self.ready) {
      self.ready = true;
      self.interrupted = false;
      self.swiping = false;
      self.widget.attr("data-ss-state", "ready");
      self.container.attr("data-ss-state", "ready");
      return;
    }
    
    if (self.lockScroll && e.type === "release") {
      self.lockScroll = false;
      self.widget.attr("data-ss-state", "ready");
      self.container.attr("data-ss-state", "ready");
      window.setTimeout(function() {
        setTranslate(self.container[0], self.offset);
      }, 0);
      return;
    }
    
    if (self.lockScroll) {
      return;
    }
    
    self.lockScroll = (Math.abs(e.gesture.angle) >= 75 && Math.abs(e.gesture.angle) <= 105 && !self.swiping) ? true : false;
    
    if (self.lockScroll) {
      return;
    }

    if (!self.ready && e.type === "touch") {
      self.interruptedOffset = (soysauce.vars.degrade) ? parseInt(self.container[0].style.left, 10) : parseInt(soysauce.getArrayFromMatrix(self.container.css(VENDOR_PREFIX + "transform"))[4], 10);
      self.interrupted = true;
      self.looping = false;
      self.container.attr("data-ss-state", "notransition");
      self.widget.attr("data-ss-state", "intransit");
      setTranslate(self.container[0], self.interruptedOffset);
      return;
    }
    
    if (e.gesture.eventType === "end") {
      var swiped = (e.gesture.velocityX >= Hammer.gestures.Swipe.defaults.swipe_velocity) ? true : false;
      var doSwipe = (swiped || e.gesture.distance >= SWIPE_THRESHOLD) ? true : false;

      soysauce.stifle(e);

      self.ready = true;
      self.swiping = false;
      
      self.widget.attr("data-ss-state", "intransit");
      self.container.attr("data-ss-state", "intransit");
      
      if (doSwipe && e.gesture.direction === "left") {
        if (!self.infinite && ((self.index === self.numChildren - 1) 
        || (self.multi && self.index === self.maxIndex - Math.floor(self.multiVars.numItems / self.multiVars.stepSize)))) {
          if (self.multi)  {
            if (self.index === self.maxIndex - 1) {
              self.gotoPos(self.offset);
            }
            else {
              self.gotoPos(self.index * -self.itemWidth * self.multiVars.stepSize + self.peekWidth);
            }
          }
          else {
            self.gotoPos(self.index * -self.itemWidth + self.peekWidth);
          }
        }
        else {
          if (soysauce.vars.degrade) {
            self.rewindCoord = parseInt(self.container.css("left"), 10);
          }
          self.slideForward();
        }
      }
      else if (doSwipe && e.gesture.direction === "right") {
        if (!self.infinite && self.index === 0) {
          self.gotoPos(self.peekWidth);
        }
        else {
          if (soysauce.vars.degrade) {
            self.rewindCoord = parseInt(self.container.css("left"), 10);
          }
          self.slideBackward();
        }
      }
      else {
        setTranslate(self.container[0], self.offset);
      }
    }
    else if (e.gesture.eventType === "move") {
      soysauce.stifle(e);
      
      self.swiping = true;
      self.ready = false;
      
      self.container.attr("data-ss-state", "notransition");
      self.widget.attr("data-ss-state", "intransit");
      
      if (self.interrupted) {
        setTranslate(self.container[0], self.interruptedOffset + e.gesture.deltaX);
      }
      else {
        setTranslate(self.container[0], self.offset + e.gesture.deltaX);
      }
    }
  };
  
  Carousel.prototype.gotoPos = function(x, jumping, resettingPosition) {
    var self = this;
    
    this.currentItem = $(this.items.get(self.index));

    if (this.overlay) {
      this.resetZoomState();
    }

    this.offset = x;
    setTranslate(this.container[0], x);
    
    this.container.attr("data-ss-state", "intransit");
    this.widget.attr("data-ss-state", "intransit");
    this.ready = true;
    
    if (this.autoscroll) {
      this.autoscrollOff();
      if (this.autoscrollRestartID) {
        window.clearInterval(self.autoscrollRestartID);
        this.autoscrollRestartID = null;
      }
    }
    
    if (this.infinite) {
      var duration = 0, xcoord = 0;
      
      duration = parseFloat(this.container.css(VENDOR_PREFIX + "transition-duration").replace(/s$/,"")) * 1000;
      
      duration = (!duration) ? 650 : duration;
      // Slide Backward Rewind
      if (!resettingPosition && !jumping && this.index === this.numChildren - 2 && !this.forward) {
        this.looping = true;
        this.infiniteID = window.setTimeout(function() {
          xcoord = (soysauce.vars.degrade) ? self.rewindCoord : parseInt(soysauce.getArrayFromMatrix(self.container.css(VENDOR_PREFIX + "transform"))[4], 10);
          self.container.attr("data-ss-state", "notransition");
          self.offset = xcoord - self.itemWidth*(self.numChildren - 2);
          setTranslate(self.container[0], self.offset);
          window.setTimeout(function() {
            self.container.attr("data-ss-state", "intransit");
            if (self.peek && /left/.test(self.peekAlign)) {
              self.offset = -self.index*self.itemWidth;
            }
            else {
              self.offset = -self.index*self.itemWidth + self.peekWidth;
            }
            setTranslate(self.container[0], self.offset);
            self.looping = false;
          }, 0);
        }, 0);
      }
      // Slide Forward Rewind
      else if (!resettingPosition && !jumping && this.index === 1 && this.forward) {
        this.looping = true;
        this.infiniteID = window.setTimeout(function() {
          xcoord = (soysauce.vars.degrade) ? self.rewindCoord : parseInt(soysauce.getArrayFromMatrix(self.container.css(VENDOR_PREFIX + "transform"))[4], 10);
          self.container.attr("data-ss-state", "notransition");
          self.offset = self.itemWidth*(self.numChildren - 2) + xcoord;
          setTranslate(self.container[0], self.offset);
          window.setTimeout(function() {
            self.container.attr("data-ss-state", "intransit");
            if (self.peek && /left/.test(self.peekAlign)) {
              self.offset = -self.itemWidth;
            }
            else {
              self.offset = -self.itemWidth + self.peekWidth;
            }
            setTranslate(self.container[0], self.offset);
            self.looping = false;
          }, 0);
        }, 0);
      }
      else {
        this.infiniteID = null;
      }
    }
  };
  
  Carousel.prototype.slideForward = function() {
    var $dots = (this.infinite) ? $(this.dots[this.index - 1]) : $(this.dots[this.index]),
        lastInfiniteIndex = this.numChildren - 1,
        stepSize = (this.multi) ? this.multiVars.stepSize * this.itemWidth : this.itemWidth;
    
    if (!this.ready || this.isZooming ||
      (!this.infinite && this.index === lastInfiniteIndex) ||
      (!this.infinite && this.multi && this.index === this.maxIndex - 1)) return false;
    
    $dots.attr("data-ss-state", "inactive");
    
    if (this.multi) {
      var $items = $(this.items.slice(this.index * this.multiVars.stepSize, this.index * this.multiVars.stepSize + this.multiVars.numItems));
      $items.attr("data-ss-state", "inactive");
      this.index++;
    }
    else {
      $(this.items[this.index++]).attr("data-ss-state", "inactive");
    }
    
    if (this.infinite && this.index === lastInfiniteIndex) {
      $(this.items[1]).attr("data-ss-state", "active");
      this.index = 1;
    }
    else {
      if (this.multi) {
        var $items;
        if (!this.multiVars.even && this.index === this.maxIndex - 1) {
          $items = $(this.items.slice(this.items.length - this.multiVars.stepSize, this.items.length));
        }
        else {
          $items = $(this.items.slice(this.index * this.multiVars.stepSize, this.index * this.multiVars.stepSize + this.multiVars.numItems));
        }
        $items.attr("data-ss-state", "active");
      }
      else {
        $(this.items[this.index]).attr("data-ss-state", "active");
      }
    }
    
    $dots = (this.infinite) ? $(this.dots[this.index - 1]) : $(this.dots[this.index]);
    $dots.attr("data-ss-state", "active");

    if (!this.infinite) {
      if (this.index === lastInfiniteIndex || (this.multi && this.index === this.maxIndex - 1)) {
        this.nextBtn.attr("data-ss-state", "disabled");
      }
      if (this.numChildren > 1) {
        this.prevBtn.attr("data-ss-state", "enabled");
      }
    }
    
    this.ready = false;
    this.forward = true;
    
    if (this.multi && !this.multiVars.even && this.index === this.maxIndex - 1) {
      stepSize -= (this.multiVars.stepSize - (this.items.length % this.multiVars.stepSize)) * this.itemWidth;
    }
    
    this.gotoPos(this.offset - stepSize);
    
    return true;
  };
  
  Carousel.prototype.slideBackward = function() {
    var $dots = (this.infinite) ? $(this.dots[this.index - 1]) : $(this.dots[this.index]),
        lastInfiniteIndex = this.numChildren - 1,
        stepSize = (this.multi) ? this.multiVars.stepSize * this.itemWidth : this.itemWidth;
    
    if (!this.ready || (!this.infinite && this.index === 0) || this.isZooming) return false;
    
    $dots.attr("data-ss-state", "inactive");
    
    if (this.multi) {
      var $items = $(this.items.slice(this.index * this.multiVars.stepSize, this.index * this.multiVars.stepSize + this.multiVars.numItems));
      $items.attr("data-ss-state", "inactive");
      this.index--;
    }
    else {
      $(this.items[this.index--]).attr("data-ss-state", "inactive");
    }
    
    if (this.infinite && this.index === 0) {
      $(this.items[lastInfiniteIndex - 1]).attr("data-ss-state", "active");
      this.index = lastInfiniteIndex - 1;
    }
    else {
      if (this.multi) {
        var $items = $(this.items.slice(this.index * this.multiVars.stepSize, this.index * this.multiVars.stepSize + this.multiVars.numItems));
        $items.attr("data-ss-state", "active");
      }
      else {
        $(this.items[this.index]).attr("data-ss-state", "active");
      }
    }
    
    $dots = (this.infinite) ? $(this.dots[this.index - 1]) : $(this.dots[this.index]);
    $dots.attr("data-ss-state", "active");
    
    if (!this.infinite) {
      if (this.index === 0) {
        this.prevBtn.attr("data-ss-state", "disabled");
      }
      if (this.numChildren > 1) {
        this.nextBtn.attr("data-ss-state", "enabled");
      }
    }
      
    this.ready = false;
    this.forward = false;
    
    if (this.multi && !this.multiVars.even && this.index === 0) {
      this.gotoPos(0 + this.peekWidth);
    }
    else {
      this.gotoPos(this.offset + stepSize);
    }
    
    return true;
  };
  
  Carousel.prototype.handleResize = function() {
    var parentWidgetContainer;
    var diff = 0;
    var prevState = "";
    var self = this;
    
    window.clearTimeout(this.resizeID);
    
    if (this.widget.is(":hidden") && !this.defer) return;

    this.widgetWidth = this.widget.outerWidth();

    // Assumption: parent is a toggler
    if (!this.widgetWidth) parentWidgetContainer = this.widget.parents().closest("[data-ss-widget='toggler'] [data-ss-component='content']");

    if (parentWidgetContainer) {
      parentWidgetContainer.css("display", "block");
      this.widgetWidth = this.widgetWidth || parentWidgetContainer.outerWidth();
    }

    if (this.fade) {
      return;
    }
    
    if (this.overlay && this.isZoomed) {
      this.resetZoomState();
    }
    
    if (this.multi) {
      if (this.multiVars.minWidth) {
        this.multiVars.numItems = Math.floor(this.widgetWidth / this.multiVars.minWidth)
      }
      this.itemWidth = this.widgetWidth / this.multiVars.numItems;
    }

    prevState = this.container.attr("data-ss-state");

    if (this.multi) {
      diff = this.widgetWidth - (this.itemWidth * this.multiVars.numItems);
    }
    else {
      diff = this.widgetWidth - this.itemWidth;
    }

    if (this.peek) {
      this.itemWidth -= this.peekWidth*2;
    }

    this.itemWidth += diff;

    if (this.peek && /left/.test(this.peekAlign)) {
      this.offset = -this.index * this.itemWidth;
    }
    else {
      this.offset = -this.index * this.itemWidth + this.peekWidth;
    }

    this.container.attr("data-ss-state", "notransition");
    if (this.widget.attr("data-ss-state")) {
      this.widget.attr("data-ss-state", "intransit");
    }

    this.items.css("width", this.itemWidth + "px");

    setTranslate(this.container[0], this.offset);

    this.container.css("width", (this.itemWidth * this.numChildren) + "px");

    if (this.autoheight) {
      this.widget.css("height", $(this.items[this.index]).outerHeight(true));
    }
    
    this.resizeID = window.setTimeout(function() {
      self.container.attr("data-ss-state", "ready");
      if (self.widget.attr("data-ss-state")) {
        self.widget.attr("data-ss-state", "ready");
      }
    }, 300);
  };
  
  Carousel.prototype.autoscrollOn = function(forceEnable) {
    var self = this;
    
    if (!this.autoscroll && !forceEnable) return false;
    
    this.autoscroll = !forceEnable ? this.autoscroll : true;
    
    if (!this.autoscrollID) {
      if (!this.autoscrollInterval) {
        var interval = this.widget.attr("data-ss-autoscroll-interval");
        this.autoscrollInterval = (!interval) ? AUTOSCROLL_INTERVAL : parseInt(interval, 10);
      }
      this.autoscrollID = window.setInterval(function() {
        if (soysauce.vars.degrade) {
          self.rewindCoord = -self.itemWidth*3 - self.peekWidth;
        }
        self.slideForward();
      }, self.autoscrollInterval);
      return true;
    }
    
    return false;
  };
  
  Carousel.prototype.autoscrollOff = function(freezing) {
    var self = this;
    if (!this.autoscroll || !this.autoscrollID && !freezing) return false;
    window.clearInterval(self.autoscrollID);
    this.autoscrollID = null;
    return true;
  };
  
  Carousel.prototype.handleFreeze = function() {
    if (this.freeze) return;
    this.freeze = true;
    this.autoscrollOff(true);
    return true;
  };
  
  Carousel.prototype.handleUnfreeze = function() {
    if (!this.freeze) return;
    this.freeze = false;
    this.autoscrollOn();
    return true;
  };
  
  Carousel.prototype.jumpTo = function(index, noZoomTransition) {
    var self = this;

    if (index === this.index) return false;

    if (this.infinite) {
      if (index < 1 || index > this.maxIndex )
        return false;
    }
    else {
      if (index < 0 || index > this.maxIndex - 1)
        return false;
    }
    
    this.jumping = true;
    this.ready = false;

    var newOffset = index * -this.itemWidth + this.peekWidth;

    if (this.infinite) {
      $(this.items[this.index]).attr("data-ss-state", "inactive");
      $(this.items[index]).attr("data-ss-state", "active");
      $(this.dots[this.index - 1]).attr("data-ss-state", "inactive");
      $(this.dots[index - 1]).attr("data-ss-state", "active");
    }
    else {
      $(this.items[this.index]).attr("data-ss-state", "inactive");
      $(this.items[index]).attr("data-ss-state", "active");
      $(this.dots[this.index]).attr("data-ss-state", "inactive");
      $(this.dots[index]).attr("data-ss-state", "active");
    }

    if (this.fade) {
      this.index = index;
      return true;
    }

    if (this.autoheight) {
      var newHeight = $(this.items[index]).outerHeight(true);
      this.widget.height(newHeight);
    }

    this.gotoPos(newOffset, true);
    this.index = index;

    return true;
  };
  
  Carousel.prototype.setTransitionedStates = function(e) {
    var self = this;
    
    if (Math.abs(e.timeStamp - self.lastTransitionEnd) < 300) return;

    self.lastTransitionEnd = e.timeStamp;
    self.widget.trigger("slideEnd");
    self.ready = true;
    self.jumping = false;
    self.interrupted = false;
    self.swiping = false;
    self.looping = false;
    self.container.attr("data-ss-state", "ready");
    self.widget.attr("data-ss-state", "ready");

    if (self.autoscroll && !self.autoscrollRestartID) {
      self.autoscrollRestartID = window.setTimeout(function() {
        self.autoscrollOn();
      }, 1000);
    }
    
    if (self.autoheight) {
      self.widget.css("height", $(self.items[self.index]).outerHeight(true));
    }
  };
  
  // Known issues:
  //  * Does not update dots
  Carousel.prototype.updateItems = function() {
    var self = this;
    
    this.ready = false;
    this.container.find("> [data-ss-component='item']:not([data-ss-state])").attr("data-ss-state", "inactive");
    
    if (!this.container.find("> [data-ss-component][data-ss-state='active']").length) {
      if (this.infinite) {
        this.container.find("> [data-ss-component='item']:nth-of-type(2)").attr("data-ss-state", "active");
      }
      else {
        this.items.first().attr("data-ss-state", "active");
      }
    }
    
    this.index = this.container.find("> [data-ss-component][data-ss-state='active']").index();
    
    this.items = this.container.find("> [data-ss-component='item']");
    this.items.css("width", this.itemWidth);
    
    this.numChildren = this.items.length;
    
    if (this.infinite) {
      this.maxIndex = this.numChildren - 2;
    }
    else {
      this.maxIndex = this.numChildren - 1;
    }
    
    this.container.css("width", this.itemWidth * this.numChildren);
    this.container.imagesLoaded(function() {
      self.ready = true;
    });
  };
  
  // Helper Functions
  function setTranslate(element, x, y) {
    x = x || 0;
    y = y || 0;
    if (soysauce.vars.degrade) {
      element.style.left = x + "px";
    }
    else {
      element.style.webkitTransform = 
      element.style.msTransform = 
      element.style.OTransform = 
      element.style.MozTransform = 
      element.style.transform =
        "translate3d(" + x + "px," + y + "px,0)";
    }
  }
  
  function setMatrix(element, scale, x, y) {
    x = x || 0;
    y = y || 0;
    element.style.webkitTransform = 
    element.style.msTransform = 
    element.style.OTransform = 
    element.style.MozTransform = 
    element.style.transform = 
      "matrix(" + scale + ",0,0," + scale + "," + x + "," + y + ")";
  }
  
  function createClones(carousel, cloneDepth) {
    var items = carousel.container.find("> [data-ss-component='item']");
    var cloneSet1, cloneSet2;
    
    if (cloneDepth > carousel.maxIndex) return;
    
    carousel.cloneDepth = cloneDepth;
    
    cloneSet1 = items.slice(0, cloneDepth).clone();
    cloneSet2 = items.slice(carousel.maxIndex - cloneDepth, carousel.maxIndex).clone();

    cloneSet1.appendTo(carousel.container);
    cloneSet2.prependTo(carousel.container);
  }
  
  return {
    init: function(selector) {
      return new Carousel(selector);
    }
  };
  
})();

soysauce.inputClear = (function() {
  
  function inputClear(selector) {
    var options = soysauce.getOptions(selector),
        self = this,
        iconFocus = false;
    
    this.widget = $(selector);
    this.icon;
    
    this.widget.on("focus keyup", function() {
      self.handleIcon();
    });
    
    this.widget.on("blur", function() {
      if (iconFocus) return;
      self.widget.attr("data-ss-clear", "off");
    });
    
    this.widget.wrap("<div data-ss-component='input-wrapper'></div>");
    
    this.widget.parent().css({
      "display": self.widget.css("display"),
      "width": self.widget.css("width")
    });
    
    this.widget.attr("data-ss-clear", "off");
    this.widget.after("<span data-ss-component='icon'></span>");
    
    this.icon = this.widget.find("+ [data-ss-component='icon']");
    
    this.icon.on("mousedown touchstart", function() {
      iconFocus = true;
      self.icon.one("mouseup touchend", function() {
        self.clear();
        iconFocus = false;
      });
    });
  }
  
  inputClear.prototype.clear = function() {
    this.widget.val("").attr("data-ss-clear", "off");
  };
  
  inputClear.prototype.handleIcon = function() {
    this.widget.attr("data-ss-clear", (!this.widget.val().length) ? "off" : "on");
  };
  
  return {
    init: function(selector) {
      return new inputClear(selector);
    }
  };
  
})();

soysauce.lazyloader = (function() {
  var THROTTLE = 100; // milliseconds
  var $window = $(window);
  var MIN_THRESHOLD = 800;

  function Lazyloader(selector) {
    var options = soysauce.getOptions(selector);
    var self = this;

    // Base Variables
    this.widget = $(selector);
    this.items = this.widget.find("[data-ss-component='item']");
    this.threshold = parseInt(this.widget.attr("data-ss-threshold"), 10) || MIN_THRESHOLD;
    this.initialLoad = parseInt(this.widget.attr("data-ss-initial-load"), 10) || 10;
    this.initialBatchLoaded = false;
    this.batchSize = parseInt(this.widget.attr("data-ss-batch-size"), 10) || 5;
    this.processing = false;
    this.button = this.widget.find("[data-ss-component='button']");
    this.complete = (this.items.length) ? false : true;
    
    // Autoload Variables
    this.autoload = false;
    this.autoloadInterval = parseInt(this.widget.attr("data-ss-interval"), 10) || 1000;
    this.autoloadIntervalID = 0;
    
    // Cache Variables
    this.cache = false;
    this.cacheInput = $("[data-ss-component='cache']");
    this.isCached = false;
    
    // Hover Variables
    this.hover = false;
    this.continueProcessing = false;

    if (options) options.forEach(function(option) {
      switch(option) {
        case "autoload":
          self.autoload = true;
        break;
        case "cache":
          if (!self.cacheInput.length) {
            console.warn("Soysauce: Cache input not found.");
          }
          else {
            self.cache = true;
            self.isCached = (parseInt(self.cacheInput.val(), 10) === 1) ? true : false;
          }
        break;
        case "hover":
          self.hover = true;
          self.autoload = true;
        break;
      }
    });
    
    if (this.cache) {
      var triggeredLoad = false;

      if (this.isCached) {
        this.widget.one("SSWidgetReady", function() {
          $window.trigger("scroll");
          self.widget.trigger("SSLoadState");
          triggeredLoad = true;
        });
      }
      else {
        this.cacheInput.val(1);
      }

      $window.one("beforeunload unload pagehide", function(e) {
        triggeredLoad = false;
        self.widget.trigger("SSSaveState");
      });
      
      $window.on("pageshow", function(e) {
        if (!e.originalEvent.persisted || triggeredLoad) return;
        $(document).ready(function() {
          $window.trigger("scroll");
          self.widget.trigger("SSLoadState");
        });
      });
    }
    
    this.processNextBatch(this.initialLoad);

    if (this.button.length) {
      this.button.on("click", function() {
        self.processNextBatch();
      });
    }

    if (this.autoload) {
      this.autoloadIntervalID = window.setInterval(function() {
        update();
      }, self.autoloadInterval);
    }
    
    function update() {
      var widgetPositionThreshold = self.widget.height() + self.widget.offset().top - self.threshold;
      var windowPosition = $window.scrollTop() + $window.height();
      
      if (windowPosition > widgetPositionThreshold) {
        self.widget.trigger("SSThreshold");
      }
    }
  };
  
  Lazyloader.prototype.processNextBatch = function(batchSize) {
    var batchSize = batchSize || this.batchSize,
      $items = $(this.items.splice(0, batchSize)),
      self = this,
      count = 0;
    
    if (this.processing || this.complete) return;
    
    this.processing = true;
    this.widget.trigger("SSBatchStart");
    
    if ($items.length === 0) {
      this.processing = false;
      this.complete = true;
      this.continueProcessing = false;
      this.widget.trigger("SSItemsEmpty");
    }
    else {
      $items.each(function(i, item) {
        var $item = $(item);
        $item.find("[data-ss-ll-src]").each(function() {
          soysauce.lateload(this);
        });
        $item.imagesLoaded(function(e) {
          $item.attr("data-ss-state", "loaded");
          if (++count === $items.length) {
            self.processing = false;
            self.widget.trigger("SSBatchLoaded");
            
            if (self.hover && self.items.length && self.initialBatchLoaded) {
              self.calcHoverThreshold();
            }
            
            if (!self.items.length) {
              self.complete = true;
              self.continueProcessing = false;
              self.widget.trigger("SSItemsEmpty");
            }
            else if (!self.initialBatchLoaded) {
              self.initialBatchLoaded = true;
              if (self.hover) {
                self.calcHoverThreshold();
              }
            }
          }
        });
      });
    }
  };
  
  Lazyloader.prototype.calcHoverThreshold = function() {
    if (!this.hover || !this.items.length) return;
    this.threshold = this.widget.height() + this.widget.offset().top - this.items.first().offset().top;
    this.threshold = (this.threshold < MIN_THRESHOLD) ? MIN_THRESHOLD : this.threshold;
  };
  
  Lazyloader.prototype.reload = function(processBatch) {
    this.items = this.widget.find("[data-ss-component='item']:not([data-ss-state])");
    if (this.items.length) {
      this.complete = false;
      if (processBatch !== false) {
        this.processNextBatch();
      }
    }
  };
  
  Lazyloader.prototype.handleResize = function() {
    if (!this.hover) return;
    this.calcHoverThreshold();
  };
  
  return {
    init: function(selector) {
      return new Lazyloader(selector);
    }
  };
  
})();

soysauce.togglers = (function() {
  var TRANSITION_END = "transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd";
  
  // Togglers
  function Toggler(selector, orphan) {
    var self = this;
    var options = soysauce.getOptions(selector);

    // Base
    if (orphan) {
      var button = $(selector);
      var togglerID = button.attr("data-ss-toggler-id");
      var query = "[data-ss-toggler-id='" + togglerID + "']";
      var tabGroupName = "";
      
      this.orphan = true;
      this.widget = $(query);
      
      this.widget.each(function(i, component) {
        var type = $(component).attr("data-ss-component");
        switch (type) {
          case "button":
            self.button = $(component);
            break;
          case "content":
            self.content = $(component);
            break;
        }
      });
      
      if (!this.content) {
        console.warn("Soysauce: No content found for toggler-id '" + togglerID + "'. Toggler may not work.");
        return;
      }
      
      this.button.click(function(e) {
        self.toggle(null, e);
      });
      
      tabGroupName = button.attr("data-ss-tab-group");
      
      this.orphanTabGroup = $("[data-ss-tab-group='" + tabGroupName  + "']");
      this.orphanTabs = (this.orphanTabGroup.length > 1) ? true : false;
      
      this.content.attr("data-ss-id", button.attr("data-ss-id"));
      
      this.allButtons = this.button;
      this.allContent = this.content;
      
      if (this.button.attr("data-ss-state") === "open") {
        this.setState("open");
        this.opened = true;
      }
      else {
        this.setState("closed");
        this.opened = false;
      }
    }
    else {
      this.widget = $(selector);
      this.orphan = false;
      this.allButtons = this.widget.find("> [data-ss-component='button']");
      this.button = this.allButtons.first();
      this.allContent = this.widget.find("> [data-ss-component='content']");
      this.content = this.allContent.first();
    }
    
    this.parentID = 0;
    this.state = "closed";
    this.isChildToggler = false;
    this.hasTogglers = false;
    this.parent = undefined;
    this.ready = true;
    this.adjustFlag = false;
    this.freeze = false;
    this.opened = this.opened || false;
    
    // Slide
    this.slide = false;
    this.height = 0;
    this.prevChildHeight = 0;
    
    // Ajax
    this.ajax = false;
    this.ajaxData;
    this.ajaxing = false;
    this.ajaxOnLoad = false;
    
    // Tab
    this.tab = false;
    this.childTabOpen = false;
    this.nocollapse = false;
    
    // Responsive
    this.responsive = false;
    this.responsiveVars = {
      threshold: parseInt(this.widget.attr("data-ss-responsive-threshold"), 10) || 768,
      accordions: true
    };
    
    if (options) options.forEach(function(option) {
      switch(option) {
        case "ajax":
          self.ajax = true;
          self.ajaxOnLoad = /true/.test(self.widget.attr("data-ss-ajax-onload"));
          break;
        case "tabs":
          self.tab = true;
          break;
        case "nocollapse":
          self.nocollapse = true;
          break;
        case "slide":
          self.slide = (soysauce.vars.degrade) ? false : true;
          break;
        case "responsive":
          self.responsive = true;
          self.tab = true;
          break;
      }
    });

    if (this.orphan) {
      this.content.on(TRANSITION_END, function() {
        self.content.trigger("slideEnd");
        self.ready = true;
      });
      return this;
    }

    this.allButtons.append("<span class='icon'></span>");
    this.allContent.wrapInner("<div data-ss-component='wrapper'/>");

    this.hasTogglers = (this.widget.has("[data-ss-widget='toggler']").length > 0) ? true : false; 
    this.isChildToggler = (this.widget.parents("[data-ss-widget='toggler']").length > 0) ? true : false;

    if (this.isChildToggler) {
      var parent = this.widget.parents("[data-ss-widget='toggler']");
      this.parentID = parseInt(parent.attr("data-ss-id"), 10);
      this.parent = soysauce.fetch(this.parentID);
    }

    if (this.widget.attr("data-ss-state") === "open") {
      this.allButtons.each(function() {
        var button = $(this);
        if (!button.attr("data-ss-state"))  {
          button.attr("data-ss-state", "closed");
          button.find("+ [data-ss-component='content']").attr("data-ss-state", "closed");
        }
        else if (button.attr("data-ss-state") === "open") {
          self.button = button;
          self.content = button.find("+ [data-ss-component='content']");
        }
      });
      this.opened = true;
    }
    else {
      this.allButtons.attr("data-ss-state", "closed");
      this.allContent.attr("data-ss-state", "closed");
      this.widget.attr("data-ss-state", "closed");
      this.opened = false;
    }
    
    if (this.slide) {
      this.widget.find("> [data-ss-component='content'][data-ss-state='open']").attr("data-ss-open-onload", "true");
      this.allContent.attr("data-ss-state", "open");

      this.allContent.each(function() {
        var content = $(this);
        content.imagesLoaded(function() {
          var height;
          if (self.hasTogglers) {
            content.find("[data-ss-component='content']").attr("data-ss-state", "closed");
          }
          height = content.outerHeight(true);
          content.attr("data-ss-slide-height", height);
          if (!content.attr("data-ss-open-onload")) {
            content.css("height", "0px");
            content.attr("data-ss-state", "closed");
          }
          else {
            self.height = height;
            content.css("height", self.height);
          }
          if (self.hasTogglers) {
            content.find("[data-ss-component='content']").removeAttr("data-ss-state");
          }
        });
      });

      this.allContent.on(TRANSITION_END, function() {
        if (!self.orphan) {
          self.widget.trigger("slideEnd");
        }
        self.ready = true;
      });
    }
    
    this.allButtons.click(function(e) {
      self.toggle(null, e);
    });
    
    if (this.responsive) {
      this.handleResponsive();
    }
    
    if (this.ajax) {
      var obj = this.widget;
      var content = this.widget.find("> [data-ss-component='content'][data-ss-ajax-url]");
      var ajaxButton;
      var url = "";
      var callback;
      var self = this;
      var firstTime = false;
      
      if (content.length === 0) {
        console.warn("Soysauce: 'data-ss-ajax-url' tag required on content. Must be on the same domain if site doesn't support CORS.");
        return;
      }
      
      content.each(function(i, contentItem) {
        ajaxButton = $(contentItem.previousElementSibling);
        if (self.ajaxOnLoad) {
          obj.on("SSWidgetReady", function() {
            injectAjaxContent(self, contentItem);
          });
        }
        else {
          ajaxButton.click(function() {
            injectAjaxContent(self, contentItem);
          });
        }
      });
      
      function injectAjaxContent(self, contentItem) {
        url = $(contentItem).attr("data-ss-ajax-url");
        
        self.setState("ajaxing");
        self.ready = false;
        self.ajaxing = true;
        
        self.ajaxData = soysauce.ajax(url);
        
        self.setAjaxComplete();
      }
    }
    
    if (this.tab && this.nocollapse) {
      this.content.imagesLoaded(function() {
        self.widget.css("min-height", self.button.outerHeight(true) + self.content.outerHeight(true));
      });
    }
  } // End constructor
  
  Toggler.prototype.openToggler = function() {
    var slideOpenWithTab = this.responsiveVars.accordions;

    if (!this.ready && !slideOpenWithTab) return;

    var self = this;
    var prevHeight = 0;

    if (this.slide) {
      if (this.responsive && !slideOpenWithTab) return;

      this.ready = false;

      if (this.adjustFlag || slideOpenWithTab) this.content.one(TRANSITION_END, function() {
        self.adjustHeight();
      });

      if (this.isChildToggler && this.parent.slide) {
        if (this.tab) {
          this.parent.setHeight(this.parent.height + this.height - this.parent.prevChildHeight);
        }
        else {
          this.parent.addHeight(this.height);
        }
        this.parent.prevChildHeight = this.height;
      }

      if (this.ajax && this.height === 0) {
        $(this.content).imagesLoaded(function() {
          self.content.css("height", "auto");
          self.height = self.content.outerHeight(true);
          self.content.css("height", self.height + "px");
        });
      }
      else {
        self.height = parseInt(self.content.attr("data-ss-slide-height"), 10);
        self.content.css("height", self.height + "px");
      }
    }
    
    if (this.tab && this.nocollapse) {
      this.widget.css("min-height", this.button.outerHeight(true) + this.content.outerHeight(true));
    }

    this.opened = true;
    this.setState("open");
  };
  
  Toggler.prototype.close = function(target, collapse) {
    var self = this;
    var $target = $(target);

    if (!this.ready) return;

    if (this.slide) {
      this.ready = false;
      if (this.isChildToggler && this.parent.slide && collapse) {
        this.parent.addHeight(-this.height);
      }
      this.content.css("height", "0px");
    }

    if (!target) {
      this.allButtons.attr("data-ss-state", "closed");
      this.allContent.attr("data-ss-state", "closed");
      this.state = "closed";
      this.opened = false;
    }
    else {
      if ($target.attr("data-ss-state") === "closed") return false;

      if ($target.attr("data-ss-component") === "button") {
        this.button = $target;
        if (!this.orphan) {
          this.content = $target.find("+ *");
        }
      }
      else {
        console.warn("Soysauce: target parameter must be a button");
      }
    }
    
    this.setState("closed");
  };
  
  Toggler.prototype.open = function(target) {
    var $target = $(target);
    
    if ($target.attr("data-ss-state") === "open") return false;
    
    if ($target.attr("data-ss-component") === "button" && !this.orphan) {
      $target = $target.find("+ *");
    }
    
    this.toggle($target[0]);
  };
  
  Toggler.prototype.doResize = function() {
    this.adjustFlag = true;
    if (this.opened) {
      this.adjustHeight();
    }
    if (this.responsive) {
      this.handleResponsive();
    }
  };
  
  Toggler.prototype.handleResize = function() {
    var self = this;
    var subWidgets = this.allContent.find("[data-ss-widget]");
    
    if (this.defer && subWidgets.length) {
      this.allContent.css({
        "clear": "both",
        "position": "relative"
      });

      if (!subWidgets.length) {
        this.doResize();
      }
      else {
        subWidgets.each(function(i, e) {
          var widget = soysauce.fetch(e).widget;

          if ((i + 1) !== subWidgets.length) return;
            
          widget.one("SSWidgetResized", function () {
            self.allContent.css({
              "clear": "",
              "position": "",
              "display": ""
            });
            self.doResize();
          });
        });
      }
    }
    else {
      this.doResize();  
    }
  };
  
  Toggler.prototype.adjustHeight = function() {
    if (!this.slide) {
      if (this.tab && this.nocollapse) {
        this.widget.css("min-height", this.button.outerHeight(true) + this.content.outerHeight(true));
      }
      return;
    }
    if (this.opened) {
      this.height = this.content.find("> [data-ss-component='wrapper']").outerHeight(true);
      this.content.attr("data-ss-slide-height", this.height).height(this.height);
    }
  };

  Toggler.prototype.addHeight = function(height) {
    this.height += height;
    this.height = (this.height < 0) ? 0 : this.height;
    if (this.slide) {
      this.content.attr("data-ss-slide-height", this.height);
    }
    this.content.css("height", this.height + "px");
  };

  Toggler.prototype.setHeight = function(height) {
    this.height = height;
    this.height = (this.height < 0) ? 0 : this.height;
    if (this.slide) {
      this.content.attr("data-ss-slide-height", this.height);
    }
    this.content.css("height", this.height + "px");
  };

  Toggler.prototype.toggle = function(component, e) {
    var self = this;
    var target;
    
    if (this.freeze || this.ajaxing) return;

    if (e) {
      target = e.target;
    }
    else {
      if (component && !this.orphan) {
        if (typeof(component) === "string") {
          target = component = this.widget.find(component)[0];
        }
        try {
          if (/content/.test(component.attributes["data-ss-component"].value)) {
            var $component = this.widget.find(component);
            target = component.previousElementSibling;
          }
        }
        catch (e) {
          console.warn("Soysauce: component passed is not a Soysauce component. Opening first toggler.");
          target = this.button[0];
        }
      }
      else {
        target = this.button[0];
        if (target && !target.attributes["data-ss-component"]) {
          console.warn("Soysauce: component passed is not a Soysauce component. Opening first toggler.");
        }
      }
    }

    if (!$(target).attr("data-ss-component")) {
      target = $(target).closest("[data-ss-component='button']")[0];
    }

    if (this.orphan) {
      if (this.opened) {
        this.opened = false;
        this.setState("closed");
      }
      else {
        if (this.orphanTabs) {
          this.orphanTabGroup.each(function() {
            var tab = soysauce.fetch(this);
            if (tab.opened) {
              tab.toggle();
            }
          }); 
        }
        this.opened = true;
        this.setState("open");
      }
      return;
    }

    if (this.tab) {
      var collapse = (this.button.attr("data-ss-state") === "open" &&
                      this.button[0] === target) ? true : false;

      if ((this.responsive && !this.responsiveVars.accordions || this.nocollapse) && (this.button[0] === target)) return;

      if (this.isChildToggler && this.tab) {
        this.parent.childTabOpen = !collapse;
        if (collapse) {
          this.parent.prevChildHeight = 0;
        }
      }

      this.close(null, collapse);

      this.button = $(target);
      this.content = $(target).find("+ [data-ss-component='content']");

      if (this.slide) {
        self.height = parseInt(self.content.attr("data-ss-slide-height"), 10);
      }

      if (collapse) {
        this.widget.attr("data-ss-state", "closed");
        this.opened = false;
        return;
      }

      this.openToggler();
    }
    else {
      this.button = $(target);
      this.content = $(target).find("+ [data-ss-component='content']");

      var collapse = (this.button.attr("data-ss-state") === "open" &&
                      this.widget.find("[data-ss-component='button'][data-ss-state='open']").length === 1) ? true : false;
      
      if (collapse) {
        this.opened = false;
      }
      
      (this.button.attr("data-ss-state") === "closed") ? this.openToggler() : this.close();
    }
  };

  Toggler.prototype.setState = function(state) {
    this.state = state;
    this.button.attr("data-ss-state", state);
    this.content.attr("data-ss-state", state);

    if (this.orphan) return;
    
    if (this.opened) {
      this.widget.attr("data-ss-state", "open");
    }
    else {
      this.widget.attr("data-ss-state", "closed");
    }

    if (this.responsive && this.opened) {
      this.handleResponsive();
    }
  };

  Toggler.prototype.setAjaxComplete = function() {
    this.ajaxing = false;
    this.ready = true;
    if (this.opened) {
      this.setState("open");
    }
    else {
      this.setState("closed");
    }
    this.widget.trigger("SSAjaxComplete");
  };

  Toggler.prototype.handleFreeze = function() {
    this.freeze = true;
  };

  Toggler.prototype.handleUnfreeze = function() {
    this.freeze = false;
  };

  Toggler.prototype.handleResponsive = function() {
    if (!this.responsive) return;
    if (window.innerWidth >= this.responsiveVars.threshold) {
      this.responsiveVars.accordions = false;
      this.widget.attr("data-ss-responsive-type", "tabs");
      if (!this.opened) {
        this.button = this.widget.find("[data-ss-component='button']").first();
        this.content = this.widget.find("[data-ss-component='content']").first();
        this.openToggler();
      }
      this.widget.css("min-height", this.button.outerHeight(true) + this.content.outerHeight(true) + "px");
    }
    else {
      this.responsiveVars.accordions = true;
      this.widget.attr("data-ss-responsive-type", "accordions");
      this.widget.css("min-height", "0");
    }
  };
  
  return {
    init: function(selector, orphan) {
      return new Toggler(selector, orphan);
    }
  };
  
})();