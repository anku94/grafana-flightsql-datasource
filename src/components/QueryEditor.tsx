import React, {useState, useMemo, useCallback, useEffect} from 'react'
import {Button, Modal, SegmentSection, Select, InlineFieldRow} from '@grafana/ui'
import {QueryEditorProps, SelectableValue} from '@grafana/data'
import {MacroType} from '@grafana/experimental'
import {FlightSQLDataSource} from '../datasource'
import {FlightSQLDataSourceOptions, SQLQuery, sqlLanguageDefinition, QUERY_FORMAT_OPTIONS} from '../types'
import {getSqlCompletionProvider, checkCasing} from './utils'

import {QueryEditorRaw} from './QueryEditorRaw'
import {BuilderView} from './BuilderView'
import {QueryHelp} from './QueryHelp'

export function QueryEditor(props: QueryEditorProps<FlightSQLDataSource, SQLQuery, FlightSQLDataSourceOptions>) {
  const {onChange, query, datasource} = props
  const [warningModal, showWarningModal] = useState(false)
  const [helpModal, showHelpModal] = useState(false)
  const [sqlInfo, setSqlInfo] = useState<any>()
  const [macros, setMacros] = useState<any>()
  const [builderView, setView] = useState(true)
  const [format, setFormat] = useState<SelectableValue<string>>()

  useEffect(() => {
    ;(async () => {
      const res = await datasource.getSQLInfo()
      const keywords = res?.frames[0].data.values[1][17]
      const numericFunctions = res?.frames[0].data.values[1][18]
      const stringFunctions = res?.frames[0].data.values[1][19]
      const systemFunctions = res?.frames[0].data.values[1][20]
      const sqlDateTimeFunctions = res?.frames[0].data.values[1][21]
      const functions = [...numericFunctions, ...stringFunctions, ...systemFunctions, ...sqlDateTimeFunctions]
      setSqlInfo({keywords: keywords, builtinFunctions: functions})
    })()
  }, [datasource])

  useEffect(() => {
    ;(async () => {
      const res = await datasource.getMacros()
      const prefix = `$__`
      const macroArr = res?.macros.map((m: any) => prefix.concat(m))
      const macros = macroArr.map((m: any) => ({text: m, name: m, id: m, type: MacroType.Value, args: []}))
      setMacros(macros)
    })()
  }, [datasource])

  const getTables = useCallback(async () => {
    const res = await datasource.getTables()
    return res.frames[0].data.values[2].map((t: string) => ({
      name: checkCasing(t),
    }))
  }, [datasource])

  const getColumns = useCallback(
    async (table: any) => {
      let res
      if (table?.value) {
        res = await datasource.getColumns(table?.value)
      }
      return res?.frames[0].schema.fields
    },
    [datasource]
  )

  const completionProvider = useMemo(
    () =>
      getSqlCompletionProvider({
        getTables,
        getColumns,
        sqlInfo,
        macros,
      }),
    [getTables, getColumns, sqlInfo, macros]
  )

  useEffect(() => {
    onChange({...query, format: format?.value})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format])

  useEffect(() => {
    setFormat(QUERY_FORMAT_OPTIONS[1])
  }, [])

  return (
    <>
      {warningModal && (
        <Modal
          title="Warning"
          closeOnBackdropClick={false}
          closeOnEscape={false}
          isOpen={warningModal}
          onDismiss={() => {
            showWarningModal(false)
          }}
        >
          {builderView
            ? 'By switching to the raw sql editor if you click to come back to the builder view you will need to refill your query.'
            : 'By switching to the builder view you will not bring your current raw query over to the builder editor, you will have to fill it out again.'}
          <Modal.ButtonRow>
            <Button fill="solid" size="md" variant="secondary" onClick={() => showWarningModal(!warningModal)}>
              Back
            </Button>
            <Button
              fill="solid"
              size="md"
              variant="destructive"
              onClick={() => {
                showWarningModal(!warningModal)
                setView(!builderView)
              }}
            >
              Switch
            </Button>
          </Modal.ButtonRow>
        </Modal>
      )}
      {builderView ? (
        <BuilderView query={props.query} datasource={datasource} onChange={onChange} />
      ) : (
        <QueryEditorRaw
          query={query}
          onChange={onChange}
          editorLanguageDefinition={{
            ...sqlLanguageDefinition,
            completionProvider,
          }}
        />
      )}
      <div style={{width: '100%'}}>
        <InlineFieldRow style={{flexFlow: 'row', alignItems: 'center'}}>
          <SegmentSection label="Format As" fill={false}>
            <Select
              options={QUERY_FORMAT_OPTIONS}
              onChange={setFormat}
              value={query.format}
              width={15}
              placeholder="Table"
            />
          </SegmentSection>
          <Button style={{marginLeft: '5px'}} fill="outline" size="md" onClick={() => showWarningModal(!warningModal)}>
            {builderView ? 'Edit SQL' : 'Builder View'}
          </Button>
          <Button style={{marginLeft: '5px'}} fill="outline" size="md" onClick={() => showHelpModal(!helpModal)}>
            Show Query Help
          </Button>
        </InlineFieldRow>
      </div>
      {helpModal && <QueryHelp />}
    </>
  )
}
