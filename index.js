'use strict';
const matchAll = require('match-all');

// Tailwind started using CSS variables for color opacity since v1.4.0,
// this helper adds a primitive support for these
const useVariables = object => {
	const newObject = {};

	for (const [key, value] of Object.entries(object)) {
		if (!key.startsWith('--')) {
			if (typeof value === 'string') {
				newObject[key] = value.replace(/var\(([a-zA-Z-]+)\)/, (_, name) => {
					return object[name];
				});
			} else {
				newObject[key] = value;
			}
		}
	}

	return newObject;
};

// Font variant numeric utilities need a special treatment, because
// there can be many font variant classes and they need to be transformed to an array
const FONT_VARIANT_REGEX = /(oldstyle-nums|lining-nums|tabular-nums|proportional-nums)/g;

const addFontVariant = (style, classNames) => {
	const matches = matchAll(classNames, FONT_VARIANT_REGEX).toArray();

	if (matches.length > 0) {
		style.fontVariant = matches;
	}
};

// Letter spacing also needs a special treatment, because its value is set
// in em unit, that's why it requires a font size to be set too
const FONT_SIZE_REGEX = /text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)/;
const LETTER_SPACING_REGEX = /(tracking-[a-z]+)/;

const addLetterSpacing = (tailwindStyles, style, classNames) => {
	const letterSpacingMatches = LETTER_SPACING_REGEX.exec(classNames);

	if (!letterSpacingMatches) {
		return;
	}

	const fontSizeMatches = FONT_SIZE_REGEX.exec(classNames);

	if (!fontSizeMatches) {
		throw new Error(
			"Font size is required when applying letter spacing, e.g. 'text-lg tracking-tighter'" // eslint-disable-line quotes
		);
	}

	const letterSpacingClass = letterSpacingMatches[0];
	const {letterSpacing} = tailwindStyles[letterSpacingClass];
	const fontSizeClass = fontSizeMatches[0];
	const {fontSize} = tailwindStyles[fontSizeClass];

	style.letterSpacing = Number.parseFloat(letterSpacing) * fontSize;
};

// The leading-x needs to be behind text-x to override line height from text-x.
const putLeadingToTheBack = (classNames, maxWidthKey) => {
	const leadingNames = [];
	const otherNames = [];
	for (const name of classNames) {
		if (name.startsWith(maxWidthKey + 'leading-')) {
			leadingNames.push(name);
		} else {
			otherNames.push(name);
		}
	}

	return [...otherNames, ...leadingNames];
};

const create = tailwindStyles => {
	const cache = {
		'': {}
	};

	// Pass a list of class names separated by a space, for example:
	// "bg-green-100 text-green-800 font-semibold")
	// and receive a styles object for use in React Native views
	const tailwind = (classNames, windowWidth = null) => {
		if (!classNames) {
			return cache[''];
		}

		// TODO: Should not hard-coded, should make them configurable
		const maxWidthKeys = ['sm:', 'md:', 'lg:', 'xl:'];
		const maxWidthValues = [640, 768, 1024, 1280];

		const haveMaxWidthKeys = maxWidthKeys.some(k => classNames.includes(k));
		if (haveMaxWidthKeys && !windowWidth) {
			throw new Error(`Found media queries usage without windowWidth: ${windowWidth}`);
		}

		classNames = classNames.replace(/\s+/g, ' ').trim().split(' ');

		// Sort by alphabets and sm:, md:, lg:, and xl:
		//   except leading-x needs to be behind text-x.
		const c1 = classNames.filter(c => !maxWidthKeys.includes(c.slice(0, 3))).sort();
		const c2 = classNames.filter(c => c.slice(0, 3) === maxWidthKeys[0]).sort();
		const c3 = classNames.filter(c => c.slice(0, 3) === maxWidthKeys[1]).sort();
		const c4 = classNames.filter(c => c.slice(0, 3) === maxWidthKeys[2]).sort();
		const c5 = classNames.filter(c => c.slice(0, 3) === maxWidthKeys[3]).sort();
		classNames = [
			...putLeadingToTheBack(c1, ''),
			...putLeadingToTheBack(c2, maxWidthKeys[0]),
			...putLeadingToTheBack(c3, maxWidthKeys[1]),
			...putLeadingToTheBack(c4, maxWidthKeys[2]),
			...putLeadingToTheBack(c5, maxWidthKeys[3])
		];

		if (haveMaxWidthKeys) {
			// Filter out class names based on windowWidth
			const i = maxWidthValues.map(maxWidth => windowWidth >= maxWidth ? 1 : 0).reduce((a, b) => a + b, 0);
			classNames = classNames.filter(className => {
				const pre = className.slice(0, 3);
				return !maxWidthKeys.includes(pre) || maxWidthKeys.slice(0, i).includes(pre);
			});

			// Remove maxWidthKeys
			classNames = classNames.map(className => {
				const pre = className.slice(0, 3);
				return maxWidthKeys.includes(pre) ? className.slice(3) : className;
			});
		}

		classNames = classNames.join(' ');

		if (!classNames) {
			return cache[''];
		}

		if (classNames in cache) {
			return cache[classNames];
		}

		const style = {};

		// TODO: Bug in the two following methods not replace previous style
		//   with later style as sorted by media queries.
		addFontVariant(style, classNames);
		addLetterSpacing(tailwindStyles, style, classNames);

		const separateClassNames = classNames
			.replace(/\s+/g, ' ')
			.trim()
			.split(' ')
			.filter(className => !className.startsWith('tracking-'))
			.filter(className => !['oldstyle-nums', 'lining-nums', 'tabular-nums', 'proportional-nums'].includes(className));

		for (const className of separateClassNames) {
			if (tailwindStyles[className]) {
				Object.assign(style, tailwindStyles[className]);
			} else {
				console.warn(`Unsupported Tailwind class: "${className}" from classNames ${classNames}`);
			}
		}

		cache[classNames] = useVariables(style);
		return cache[classNames];
	};

	// Pass the name of a color (e.g. "blue-500") and receive a color value (e.g. "#4399e1"),
	// or a color and opacity (e.g. "black opacity-50") and get a color with opacity (e.g. "rgba(0,0,0,0.5)")
	const getColor = name => {
		const style = tailwind(name.split(' ').map(className => `bg-${className}`).join(' '));
		return style.backgroundColor;
	};

	return {tailwind, getColor};
};

const {tailwind, getColor} = create(require('./styles.json'));

module.exports = tailwind;
module.exports.default = tailwind;
module.exports.getColor = getColor;
module.exports.create = create;
