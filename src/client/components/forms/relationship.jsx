/*
 * Copyright (C) 2015  Ben Ockmore
 *               2015  Sean Burke
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

const Handlebars = require('handlebars');
const Icon = require('react-fontawesome');
const React = require('react');
const request = require('superagent-bluebird-promise');
const _ = require('lodash');
const _filter = require('lodash.filter');

const Alert = require('react-bootstrap').Alert;
const Button = require('react-bootstrap').Button;
const Input = require('react-bootstrap').Input;
const PageHeader = require('react-bootstrap').PageHeader;

const validators = require('../validators');

const Select = require('../input/select2.jsx');
const SearchSelect = require('../input/entity-search.jsx');

function getEntityLink(entity) {
	'use strict';
	const bbid = entity.bbid;
	return `/${entity.type.toLowerCase()}/${bbid}`;
}

function renderRelationship(relationship) {
	'use strict';
	const template = Handlebars.compile(
		relationship.type.displayTemplate,
		{noEscape: true}
	);

	const data = {
		entities: [
			relationship.source,
			relationship.target
		].map((entity) => {
			// Linkify source and target based on default alias
			const name = entity.defaultAlias ?
				entity.defaultAlias.name : '(unnamed)';
			return `<a href="${getEntityLink(entity)}">${name}</a>`;
		})
	};

	return template(data);
}

function getRelationshipTypeById(types, id) {
	'use strict';

	return _.find(
		types, (type) => type.id === id
	);
}

function isRelationshipNew(initialType, initialTarget) {
	'use strict';
	return !(initialType || initialTarget);
}

function _entityHasChanged(initial, current) {
	'use strict';

	return (initial && initial.bbid) !== (current && current.bbid);
}

const RelationshipRow = React.createClass({
	displayName: 'RelationshipRow',
	propTypes: {
		entity: React.PropTypes.shape({
			bbid: React.PropTypes.string
		}),
		relationship: React.PropTypes.shape({
			source: React.PropTypes.object,
			target: React.PropTypes.object,
			typeId: React.PropTypes.number,
			initialSource: React.PropTypes.object,
			initialTarget: React.PropTypes.object,
			initialTypeId: React.PropTypes.number
		}),
		relationshipTypes:
			React.PropTypes.arrayOf(validators.labeledProperty),
		onChange: React.PropTypes.func,
		onDelete: React.PropTypes.func,
		onSelect: React.PropTypes.func,
		onSwap: React.PropTypes.func
	},
	getInitialState() {
		'use strict';

		return {
			deleted: false,
			entitiesSwapped: false,
			swapped: false
		};
	},
	getValue() {
		'use strict';

		return {
			source: this.source.getValue(),
			target: this.target.getValue(),
			typeId: this.type.getValue() ?
				parseInt(this.type.getValue(), 10) : null
		};
	},
	swap() {
		'use strict';

		this.setState({a: this.state.b, b: this.state.a});
	},
	handleDeleteClick() {
		'use strict';

		this.setState({deleted: true});
		this.props.onDelete();
	},
	handleResetClick() {
		'use strict';

		this.setState({deleted: false});
	},
	selected() {
		'use strict';

		return this.select.getChecked();
	},
	added() {
		'use strict';

		const initiallyEmpty = !this.props.relationship.initialTarget &&
			!this.props.relationship.initialTypeId;
		const nowSet = this.props.relationship.target ||
			this.props.relationship.typeId;
		return Boolean(initiallyEmpty && nowSet);
	},
	edited() {
		'use strict';

		const rel = this.props.relationship;
		const aChanged = _entityHasChanged(rel.initialSource, rel.source);
		const bChanged = _entityHasChanged(rel.initialTarget, rel.target);
		const typeChanged = rel.typeId !== rel.initialTypeId;
		return Boolean(aChanged || bChanged || typeChanged);
	},
	renderedRelationship() {
		'use strict';

		const rel = this.props.relationship;

		if (!this.valid()) {
			return null;
		}

		rel.type = this.currentRelationshipType();

		return {__html: renderRelationship(rel)};
	},
	rowClass() {
		'use strict';

		if (this.disabled()) {
			return ' disabled';
		}
		if (this.state.deleted) {
			return ' list-group-item-danger';
		}
		if (this.added()) {
			return ' list-group-item-success';
		}
		if (this.edited()) {
			return ' list-group-item-warning';
		}
		return '';
	},
	valid() {
		'use strict';

		const rel = this.props.relationship;
		if (rel.source && rel.target && rel.typeId) {
			return true;
		}

		return false;
	},
	disabled() {
		'use strict';

		// Temporarily disable editing until the webservice/orm supports this
		const rel = this.props.relationship;
		return Boolean(rel.initialSource && rel.initialTarget);
	},
	currentRelationshipType() {
		'use strict';
		return getRelationshipTypeById(
			this.props.relationshipTypes, this.props.relationship.typeId
		);
	},
	render() {
		'use strict';

		const deleteButton = this.rowClass() || this.valid() ? (
			<Button
				bsStyle="danger"
				onClick={this.handleDeleteClick}
			>
				<Icon name="times"/>&nbsp;Delete
				<span className="sr-only"> Relationship</span>
			</Button>
		) : null;

		const resetButton = (
			<Button
				bsStyle="primary"
				onClick={this.handleResetClick}
			>
				<Icon name="undo"/>&nbsp;Reset
				<span className="sr-only"> Relationship</span>
			</Button>
		);

		const swapButton = (
			<Button
				bsStyle="primary"
				onClick={this.props.onSwap}
			>
				<Icon name="exchange"/>&nbsp;Swap
				<span className="sr-only"> Entities</span>
			</Button>
		);

		function _entityToOption(entity) {
			if (!entity) {
				return null;
			}

			entity.text = entity.defaultAlias ?
				entity.defaultAlias.name : '(unnamed)';
			entity.id = entity.bbid;

			return entity;
		}

		const sourceEntity = _entityToOption(this.props.relationship.source);
		const targetEntity = _entityToOption(this.props.relationship.target);

		let validationState = null;
		if (this.rowClass()) {
			validationState = this.valid() ? 'success' : 'error';
		}

		const select2Options = {
			allowClear: false,
			width: '100%'
		};

		const targetInput = (
			<SearchSelect
				standalone
				bsStyle={validationState}
				disabled={
					this.disabled() || this.state.deleted ||
					(targetEntity && targetEntity.bbid) ===
						this.props.entity.bbid
				}
				labelClassName="col-md-4"
				placeholder="Select entity…"
				ref={(ref) => this.target = ref}
				select2Options={select2Options}
				value={targetEntity}
				wrapperClassName="col-md-4"
				onChange={this.props.onChange}
			/>
		);

		const deleteOrResetButton =
			this.state.deleted ? resetButton : deleteButton;

		let deprecationWarning = null;
		const currentType = this.currentRelationshipType();
		if (currentType && currentType.deprecated) {
			deprecationWarning = (
				<span className="text-danger">
					<Icon name="warning"/>&nbsp;
					Relationship type deprecated &mdash; please avoid!
				</span>
			);
		}

		return (
			<div
				className={`list-group-item margin-top-1 + ${this.rowClass()}`}
			>
				<div className="row">
					<div className="col-md-1 text-center margin-top-1">
						<Input
							className="margin-left-0"
							disabled={this.disabled() || this.state.deleted}
							label=" "
							ref={(ref) => this.select = ref}
							type="checkbox"
							onClick={this.props.onSelect}
						/>
					</div>
					<div className="col-md-11">
						<div className="row">
							<SearchSelect
								standalone
								bsStyle={validationState}
								disabled={
									this.disabled() || this.state.deleted ||
									(sourceEntity && sourceEntity.bbid) ===
										this.props.entity.bbid
								}
								labelClassName="col-md-4"
								placeholder="Select entity…"
								ref={(ref) => this.source = ref}
								select2Options={select2Options}
								value={sourceEntity}
								wrapperClassName="col-md-4"
								onChange={this.props.onChange}
							/>
							<div className="col-md-4">
								<Select
									noDefault
									bsStyle={validationState}
									defaultValue={
										this.props.relationship.typeId
									}
									disabled={
										this.disabled() || this.state.deleted
									}
									idAttribute="id"
									labelAttribute="label"
									options={this.props.relationshipTypes}
									placeholder="Select relationship type…"
									ref={(ref) => this.type = ref}
									select2Options={select2Options}
									onChange={this.props.onChange}
								/>
							</div>
							{targetInput}
						</div>
						<div className="row">
							<div className="col-md-4">
								<p dangerouslySetInnerHTML={
										this.renderedRelationship()
									}
								/>
							</div>
							<div className="col-md-5">
								{deprecationWarning}
							</div>
							<div className="col-md-3 text-right">
								{
									this.state.deleted || this.disabled() ?
										null : swapButton
								}
								{this.disabled() ? null : deleteOrResetButton}
							</div>

						</div>
					</div>
				</div>

			</div>
		);
	}
});

const RelationshipEditor = React.createClass({
	displayName: 'RelationshipEditor',
	propTypes: {
		entity: React.PropTypes.shape({
			bbid: React.PropTypes.string
		}),
		loadedEntities: React.PropTypes.object,
		relationshipTypes: React.PropTypes.arrayOf(validators.labeledProperty),
		relationships: React.PropTypes.arrayOf(React.PropTypes.shape({
			source: React.PropTypes.object,
			target: React.PropTypes.object,
			typeId: React.PropTypes.number
		}))
	},
	getInitialState() {
		'use strict';

		const existing = (this.props.relationships || []).map((rel) => ({
			source: rel.source,
			target: rel.target,
			typeId: rel.typeId
		}));

		existing.push({
			source: this.props.entity,
			target: null,
			typeId: null
		});

		existing.forEach((rel, i) => {
			rel.key = i;
			rel.initialSource = rel.source;
			rel.initialTarget = rel.target;
			rel.initialTypeId = rel.typeId;
			rel.valid = rel.changed = false;
		});

		return {
			loadedEntities: this.props.loadedEntities,
			relationships: existing,
			rowsSpawned: existing.length,
			numSelected: 0
		};
	},
	getValue() {
		'use strict';

		const relationships = [];

		for (let i = 0; i < this.state.relationships.length; i++) {
			relationships.push(this.refs[i].getValue());
		}

		return relationships;
	},
	handleSubmit() {
		'use strict';

		const changedRelationships = _filter(
			this.state.relationships, (rel) => rel.changed && rel.valid
		);

		request.post('./relationships/handler')
			.send(changedRelationships)
			.promise()
			.then(() => {
				window.location.href = getEntityLink(this.props.entity);
			});
	},
	getInternalValue() {
		'use strict';

		const updatedRelationships = this.getValue();

		updatedRelationships.forEach((rel, idx) => {
			rel.key = this.state.relationships[idx].key;
			rel.initialSource = this.state.relationships[idx].initialSource;
			rel.initialTarget = this.state.relationships[idx].initialTarget;
			rel.initialTypeId = this.state.relationships[idx].initialTypeId;

			const sourceChanged =
				_entityHasChanged(rel.initialSource, rel.source);
			const targetChanged =
				_entityHasChanged(rel.initialTarget, rel.target);
			const typeChanged = (rel.typeId !== rel.initialTypeId);

			rel.changed = sourceChanged || targetChanged || typeChanged;
			rel.valid = Boolean(rel.source && rel.target && rel.typeId);
		});

		return updatedRelationships;
	},
	swap(changedRowIndex) {
		'use strict';

		const updatedRelationships = this.getInternalValue();

		updatedRelationships[changedRowIndex].source =
			this.state.relationships[changedRowIndex].target;
		updatedRelationships[changedRowIndex].target =
			this.state.relationships[changedRowIndex].source;

		const rowsSpawned =
			this.addRowIfNeeded(updatedRelationships, changedRowIndex);

		this.setState({
			relationships: updatedRelationships,
			rowsSpawned
		});
	},
	handleBulkDelete() {
		'use strict';

		const relationshipsToDelete = _.reject(
			this.state.relationships.map((rel, idx) => (
				this.refs[idx].selected() ? idx : null
			)), (idx) => idx === null
		);

		relationshipsToDelete.sort((a, b) => b - a).forEach((idx) => {
			this.refs[idx].handleDeleteClick();
		});
	},
	stateUpdateNeeded(changedRowIndex) {
		'use strict';

		const updatedRelationship = this.refs[changedRowIndex].getValue();
		const existingRelationship = this.state.relationships[changedRowIndex];

		function _valueJustSetOrUnset(existing, updated) {
			return !existing && updated || existing && !updated;
		}

		const sourceJustSetOrUnset = _valueJustSetOrUnset(
			existingRelationship.source,
			updatedRelationship.source
		);

		const targetJustSetOrUnset = _valueJustSetOrUnset(
			existingRelationship.target,
			updatedRelationship.target
		);

		const typeJustSetOrUnset = _valueJustSetOrUnset(
			existingRelationship.typeId,
			updatedRelationship.typeId
		);

		return Boolean(
			sourceJustSetOrUnset || targetJustSetOrUnset || typeJustSetOrUnset
		);
	},
	addRowIfNeeded(updatedRelationships, changedRowIndex) {
		'use strict';
		let rowsSpawned = this.state.rowsSpawned;
		if (changedRowIndex === this.state.relationships.length - 1) {
			updatedRelationships.push({
				initialSource: this.props.entity,
				initialTarget: null,
				initialTypeId: null,
				source: this.props.entity,
				target: null,
				typeId: null,
				key: rowsSpawned++
			});
		}

		return rowsSpawned;
	},
	deleteRowIfNew(rowToDelete) {
		'use strict';

		if (this.refs[rowToDelete].added()) {
			const updatedRelationships = this.getInternalValue();

			updatedRelationships.splice(rowToDelete, 1);

			let newNumSelected = this.state.numSelected;
			if (this.refs[rowToDelete].selected()) {
				newNumSelected--;
			}

			this.setState({
				relationships: updatedRelationships,
				numSelected: newNumSelected
			});
		}
	},
	handleChange(changedRowIndex) {
		'use strict';

		const updatedRelationships = this.getInternalValue();

		const rowsSpawned =
			this.addRowIfNeeded(updatedRelationships, changedRowIndex);

		this.setState({
			relationships: updatedRelationships,
			rowsSpawned
		});
	},
	handleSelect(selectedRowIndex) {
		'use strict';

		let newNumSelected = this.state.numSelected;
		if (this.refs[selectedRowIndex].selected()) {
			newNumSelected++;
		}
		else {
			newNumSelected--;
		}

		this.setState({
			numSelected: newNumSelected
		});
	},
	hasDataToSubmit() {
		'use strict';

		const changedRelationships = _filter(
			this.state.relationships, (rel) =>
				rel.changed && rel.valid
		);
		return changedRelationships.length > 0;
	},
	render() {
		'use strict';


		const typesWithoutDeprecated = _filter(
			this.props.relationshipTypes, (type) => !type.deprecated
		);

		const rows = this.state.relationships.map((rel, index) => (
			<RelationshipRow
				{...this.props}
				key={rel.key}
				ref={index}
				relationship={rel}
				relationshipTypes={
					isRelationshipNew(
						rel.initialTypeId, rel.initialTarget
					) ? typesWithoutDeprecated : this.props.relationshipTypes
				}
				onChange={this.handleChange.bind(null, index)}
				onDelete={this.deleteRowIfNew.bind(null, index)}
				onSelect={this.handleSelect.bind(null, index)}
				onSwap={this.swap.bind(null, index)}
			/>
		));

		const numSelectedString =
			this.state.numSelected ? `(${this.state.numSelected})` : '';

		return (
			<div>
				<PageHeader>
					<span className="pull-right">
						<Button
							bsStyle="danger"
							disabled={this.state.numSelected === 0}
							onClick={this.handleBulkDelete}
						>
							{`Delete Selected ${numSelectedString}`}
						</Button>
					</span>
					Relationship Editor
				</PageHeader>
				<Alert
					bsStyle="info"
					className="text-center"
				>
					<b>Please note!</b><br/>
					The new relationship editor doesn&rsquo;t yet support
					editing or deleting of existing relationships. This is
					coming soon, but for now, existing relationships show up as
					un-editable.
				</Alert>
				<div className="list-group">
					{rows}
				</div>

				<div className="pull-right">
					<Button
						bsStyle="success"
						disabled={!this.hasDataToSubmit()}
						onClick={this.handleSubmit}
					>
						Submit
					</Button>
				</div>
			</div>
		);
	}
});

module.exports = RelationshipEditor;
